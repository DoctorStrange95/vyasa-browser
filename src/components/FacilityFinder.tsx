"use client";
import { useState, useEffect } from "react";

type FacilityType = "hospital" | "phc" | "chc" | "doctor" | "pharmacy" | "lab" | "bloodbank" | "ambulance" | "anganwadi";
type LocMode = "gps" | "text";

interface Place {
  place_id: string;
  name: string;
  vicinity: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  geometry: { location: { lat: number; lng: number } };
}

interface SavedLoc { label: string; lat: number; lng: number; }

const LS_KEY    = "ff_locs_v1";
const MAX_SAVED = 6;

function readSaved(): SavedLoc[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function writeSaved(loc: SavedLoc) {
  try {
    const list = [loc, ...readSaved().filter(l => l.label !== loc.label)].slice(0, MAX_SAVED);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

const CATEGORIES: { type: FacilityType; icon: string; label: string; color: string }[] = [
  { type: "hospital",  icon: "🏥", label: "Hospital",         color: "#2dd4bf" },
  { type: "phc",       icon: "🏛️", label: "PHC / Sub-Ctr",   color: "#34d399" },
  { type: "chc",       icon: "🏨", label: "CHC / Dist. Hosp", color: "#22c7bb" },
  { type: "doctor",    icon: "👨‍⚕️", label: "Doctor/Clinic",   color: "#60a5fa" },
  { type: "pharmacy",  icon: "💊", label: "Pharmacy",         color: "#4ade80" },
  { type: "lab",       icon: "🔬", label: "Diagnostic Lab",   color: "#818cf8" },
  { type: "bloodbank", icon: "🩸", label: "Blood Bank",       color: "#f87171" },
  { type: "ambulance", icon: "🚑", label: "Ambulance",        color: "#fb923c" },
  { type: "anganwadi", icon: "🏫", label: "Anganwadi",        color: "#fbbf24" },
];

// ── Ayushman name-matching helpers ─────────────────────────────────────────
const HOSP_STOP = /\b(hospital|nursing\s*home|health\s*care|healthcare|medical|centre|center|clinic|pvt|ltd|private|limited|trust|govt|government|super|multi|speciali[ts][ty]?|dr|and|the|of)\b/g;

function normalizeHosp(name: string): string {
  return name.toLowerCase()
    .replace(HOSP_STOP, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAyushmanMatch(placeName: string, ayushSet: Set<string>): boolean {
  const norm = normalizeHosp(placeName);
  if (norm.length < 3) return false;
  for (const ayushNorm of ayushSet) {
    if (!ayushNorm || ayushNorm.length < 3) continue;
    if (ayushNorm.includes(norm) || norm.includes(ayushNorm)) return true;
    const pTok = norm.split(" ").filter(t => t.length >= 3);
    const aTok = ayushNorm.split(" ").filter(t => t.length >= 3);
    if (pTok.length === 0 || aTok.length === 0) continue;
    const overlap = pTok.filter(t => aTok.includes(t)).length;
    if (overlap >= Math.min(2, Math.min(pTok.length, aTok.length))) return true;
  }
  return false;
}

export default function FacilityFinder() {
  const [active,          setActive]         = useState<FacilityType>("hospital");
  const [locMode,         setLocMode]        = useState<LocMode>("gps");
  const [query,           setQuery]          = useState("");
  const [places,          setPlaces]         = useState<Place[]>([]);
  const [status,          setStatus]         = useState<"idle"|"locating"|"loading"|"done"|"error"|"nokey">("idle");
  const [errMsg,          setErrMsg]         = useState("");
  const [radius,          setRadius]         = useState("5000");
  const [location,        setLocation]       = useState<string>("");
  const [coords,          setCoords]         = useState<{lat:number;lng:number}|null>(null);
  const [savedLocs,       setSavedLocs]      = useState<SavedLoc[]>([]);
  const [showSaved,       setShowSaved]      = useState(false);

  // Ayushman filter state
  const [ayushmanOn,      setAyushmanOn]     = useState(false);
  const [ayushmanSet,     setAyushmanSet]    = useState<Set<string>>(new Set());
  const [ayushmanLoading, setAyushmanLoading] = useState(false);

  useEffect(() => { setSavedLocs(readSaved()); }, []);

  // Load ALL Ayushman empanelled hospital names for the state at these coords
  async function loadAyushmanData(lat: number, lng: number, locationStr: string) {
    setAyushmanLoading(true);
    try {
      let rawState = "";

      // Pincode geocode returns: "PostOffice, District, State — XXXXXX"
      const pinMatch = locationStr.match(/^.+?,\s*(.+?),\s*(.+?)\s*—/);
      if (pinMatch) {
        rawState = pinMatch[2].trim();
      } else {
        // GPS — reverse-geocode to get state name
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
          { headers: { "User-Agent": "Vyasa/2.0" } }
        ).then(r => r.json());
        rawState = geo?.address?.state ?? "";
      }

      if (!rawState) return;

      // Match against available Ayushman states
      const statesRes  = await fetch("/api/citizens/hospitals?states=true");
      const statesList: { stateSlug: string; stateName: string }[] = await statesRes.json();
      const rawLow = rawState.toLowerCase();
      const matchState = statesList.find(s => {
        const sLow = s.stateName.toLowerCase();
        return sLow.includes(rawLow.split(" ")[0]) || rawLow.includes(sLow.split(" ")[0]);
      });
      if (!matchState) return;

      // Fetch ALL hospital names for the state (namesOnly skips pagination)
      const hospRes = await fetch(`/api/citizens/hospitals?state=${matchState.stateSlug}&namesOnly=true`);
      const data    = await hospRes.json();
      const names: string[] = data.names ?? [];

      setAyushmanSet(new Set(names.map(n => normalizeHosp(n))));
    } catch {
      // silently ignore — Ayushman overlay is best-effort
    } finally {
      setAyushmanLoading(false);
    }
  }

  async function searchByCoords(lat: number, lng: number, type: FacilityType, rad: string, loc?: string) {
    setStatus("loading");
    setCoords({ lat, lng });
    setAyushmanSet(new Set()); // clear stale Ayushman data on new search
    try {
      const res = await fetch(`/api/nearby-centres?lat=${lat}&lng=${lng}&radius=${rad}&type=${type}`);
      const d   = await res.json();
      if (d.needsKey) { setStatus("nokey"); return; }
      if (d.error)    { setErrMsg(d.error); setStatus("error"); return; }
      setPlaces(d.results ?? []);
      setStatus("done");
      // Auto-load Ayushman data if toggle is on and we're looking at hospitals
      if (ayushmanOn && type === "hospital") {
        loadAyushmanData(lat, lng, loc ?? location);
      }
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  async function searchByText() {
    if (!query.trim()) return;
    setShowSaved(false);
    setStatus("locating");
    try {
      const geo = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const g   = await geo.json();
      if (g.error) { setErrMsg(g.error); setStatus("error"); return; }
      setLocation(g.formatted);
      writeSaved({ label: g.formatted, lat: g.lat, lng: g.lng });
      setSavedLocs(readSaved());
      searchByCoords(g.lat, g.lng, active, radius, g.formatted);
    } catch {
      setErrMsg("Could not locate. Try a different pincode or district name.");
      setStatus("error");
    }
  }

  function searchByGPS() {
    if (!navigator.geolocation) { setErrMsg("Geolocation not supported."); setStatus("error"); return; }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation("Your location");
        searchByCoords(pos.coords.latitude, pos.coords.longitude, active, radius, "");
      },
      err => { setErrMsg(`Location denied: ${err.message}`); setStatus("error"); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function changeType(t: FacilityType) {
    setActive(t);
    if (coords && status !== "idle") {
      searchByCoords(coords.lat, coords.lng, t, radius);
    }
  }

  function selectSavedLocation(loc: SavedLoc) {
    setQuery(loc.label);
    setLocation(loc.label);
    setShowSaved(false);
    searchByCoords(loc.lat, loc.lng, active, radius, loc.label);
  }

  function toggleAyushman() {
    const next = !ayushmanOn;
    setAyushmanOn(next);
    if (next && coords && active === "hospital" && status === "done" && ayushmanSet.size === 0) {
      loadAyushmanData(coords.lat, coords.lng, location);
    }
    if (!next) setAyushmanSet(new Set());
  }

  const cat          = CATEGORIES.find(c => c.type === active)!;
  const filteredSaved = savedLocs.filter(l =>
    !query || l.label.toLowerCase().includes(query.toLowerCase())
  );

  // Sort Ayushman-empanelled hospitals to the top when toggle is on
  const displayPlaces = (ayushmanOn && ayushmanSet.size > 0 && active === "hospital")
    ? [...places].sort((a, b) => {
        const am = isAyushmanMatch(a.name, ayushmanSet) ? 1 : 0;
        const bm = isAyushmanMatch(b.name, ayushmanSet) ? 1 : 0;
        return bm - am;
      })
    : places;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0.75rem" }}>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, overflowX: "auto", paddingBottom: "2px" }}>
        {CATEGORIES.map(c => (
          <button key={c.type} onClick={() => changeType(c.type)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem",
            padding: "0.5rem 0.6rem", flexShrink: 0, minWidth: "58px",
            backgroundColor: active === c.type ? "#0f2040" : "#060d1a",
            border: `1px solid ${active === c.type ? c.color : "#1e3a5f"}`,
            borderBottom: `2px solid ${active === c.type ? c.color : "transparent"}`,
            borderRadius: "8px", cursor: "pointer", transition: "all 0.12s",
          }}>
            <span style={{ fontSize: "1.1rem" }}>{c.icon}</span>
            <span style={{ fontSize: "0.56rem", color: active === c.type ? c.color : "#475569", fontWeight: active === c.type ? 700 : 400, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Location mode toggle + radius */}
      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
        <div style={{ display: "flex", backgroundColor: "#060d1a", border: "1px solid #1e3a5f", borderRadius: "7px", overflow: "hidden", flexShrink: 0 }}>
          {(["gps", "text"] as LocMode[]).map(m => (
            <button key={m} onClick={() => setLocMode(m)} style={{
              fontSize: "0.7rem", padding: "0.35rem 0.7rem",
              background: locMode === m ? "#0f2040" : "transparent",
              color: locMode === m ? "#e2e8f0" : "#475569",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>
              {m === "gps" ? "📍 GPS" : "🔍 Pincode / District"}
            </button>
          ))}
        </div>
        <select value={radius} onChange={e => setRadius(e.target.value)} style={{ backgroundColor: "#060d1a", border: "1px solid #1e3a5f", borderRadius: "7px", color: "#64748b", fontSize: "0.7rem", padding: "0.35rem 0.5rem", fontFamily: "inherit", cursor: "pointer" }}>
          <option value="3000">3 km</option>
          <option value="5000">5 km</option>
          <option value="10000">10 km</option>
          <option value="20000">20 km</option>
        </select>
      </div>

      {/* Search bar */}
      {locMode === "text" ? (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSaved(true); }}
              onFocus={() => setShowSaved(true)}
              onBlur={() => setTimeout(() => setShowSaved(false), 150)}
              onKeyDown={e => e.key === "Enter" && searchByText()}
              placeholder="6-digit pincode or district (e.g. 400001, Kozhikode)"
              style={{ flex: 1, backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "7px", color: "#e2e8f0", fontSize: "0.78rem", padding: "0.45rem 0.75rem", fontFamily: "inherit", outline: "none" }}
            />
            <button onClick={searchByText} disabled={!query.trim() || status === "loading" || status === "locating"} style={{ fontSize: "0.75rem", backgroundColor: cat.color + "20", border: `1px solid ${cat.color}60`, color: cat.color, borderRadius: "7px", padding: "0.45rem 0.9rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>
              Search
            </button>
          </div>
          {showSaved && filteredSaved.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: "80px", backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "7px", zIndex: 20, overflow: "hidden", boxShadow: "0 4px 12px #00000060" }}>
              <div style={{ fontSize: "0.6rem", color: "#334155", padding: "0.3rem 0.75rem", borderBottom: "1px solid #0f2040" }}>Recent searches</div>
              {filteredSaved.map(loc => (
                <button key={loc.label} onMouseDown={() => selectSavedLocation(loc)} style={{
                  display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0.75rem",
                  fontSize: "0.72rem", color: "#94a3b8", backgroundColor: "transparent", border: "none",
                  cursor: "pointer", borderBottom: "1px solid #0a1628", fontFamily: "inherit",
                }}>
                  🕐 {loc.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={searchByGPS} disabled={status === "locating" || status === "loading"} style={{ fontSize: "0.8rem", backgroundColor: cat.color + "15", border: `1px solid ${cat.color}40`, color: cat.color, borderRadius: "8px", padding: "0.6rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>
          {status === "locating" ? "Getting location…" : `Find ${cat.label} near me`}
        </button>
      )}

      {/* Status messages */}
      {status === "loading" && (
        <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "center", padding: "1rem" }}>
          Searching {cat.label}s nearby…
        </div>
      )}
      {status === "error" && (
        <div style={{ fontSize: "0.75rem", color: "#f87171", backgroundColor: "#ef444415", border: "1px solid #ef444430", borderRadius: "8px", padding: "0.6rem 0.75rem", flexShrink: 0 }}>
          ⚠ {errMsg}
          <button onClick={() => setStatus("idle")} style={{ marginLeft: "0.5rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem" }}>Dismiss</button>
        </div>
      )}
      {status === "nokey" && (
        <div style={{ fontSize: "0.75rem", color: "#eab308", backgroundColor: "#eab30815", border: "1px solid #eab30830", borderRadius: "8px", padding: "0.6rem 0.75rem", flexShrink: 0 }}>
          Google Places API key not configured. Add <code style={{ background: "#0f2040", padding: "0 0.3rem", borderRadius: "3px" }}>GOOGLE_PLACES_API_KEY</code> to .env.local.
        </div>
      )}

      {/* Results */}
      {status === "done" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Summary + Ayushman toggle (hospitals only) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "0.5rem" }}>
            <div style={{ fontSize: "0.65rem", color: "#475569" }}>
              {places.length} {cat.label}{places.length !== 1 ? "s" : ""} found {location ? `near ${location}` : ""}
            </div>
            {active === "hospital" && (
              <button
                onClick={toggleAyushman}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "0.25rem 0.6rem",
                  backgroundColor: ayushmanOn ? "#78350f30" : "#060d1a",
                  border: `1px solid ${ayushmanOn ? "#f59e0b" : "#1e3a5f"}`,
                  borderRadius: "20px", cursor: "pointer", flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "0.75rem" }}>🛡️</span>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: ayushmanOn ? "#f59e0b" : "#475569" }}>
                  Ayushman
                </span>
                {ayushmanLoading && (
                  <span style={{ fontSize: "0.55rem", color: "#78350f" }}>…</span>
                )}
                {ayushmanOn && !ayushmanLoading && ayushmanSet.size > 0 && (
                  <span style={{ fontSize: "0.55rem", color: "#92400e", backgroundColor: "#f59e0b20", borderRadius: "10px", padding: "0 0.3rem" }}>
                    {displayPlaces.filter(p => isAyushmanMatch(p.name, ayushmanSet)).length} found
                  </span>
                )}
              </button>
            )}
          </div>

          {places.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "#334155", fontSize: "0.8rem" }}>
              None found within {Number(radius)/1000} km. Try expanding the radius.
            </div>
          ) : (
            displayPlaces.map(p => (
              <PlaceCard
                key={p.place_id}
                place={p}
                color={cat.color}
                isAyushman={ayushmanOn && ayushmanSet.size > 0 && isAyushmanMatch(p.name, ayushmanSet)}
              />
            ))
          )}
        </div>
      )}

      {status === "idle" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem", color: "#334155" }}>
          <span style={{ fontSize: "2rem" }}>{cat.icon}</span>
          <span style={{ fontSize: "0.78rem" }}>Search for nearby {cat.label}s</span>
          <span style={{ fontSize: "0.65rem", color: "#1e3a5f" }}>Use GPS or enter a pincode / district name</span>
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, color, isAyushman }: { place: Place; color: string; isAyushman?: boolean }) {
  const isOpen  = place.opening_hours?.open_now;
  const address = place.formatted_address ?? place.vicinity;
  const phone   = place.formatted_phone_number;
  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;

  return (
    <div style={{
      backgroundColor: "#080f1e",
      border: isAyushman ? "1px solid #f59e0b40" : "1px solid #1e3a5f",
      borderLeft: `3px solid ${isAyushman ? "#f59e0b" : color}`,
      borderRadius: "8px", padding: "0.7rem 0.85rem", flexShrink: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.3rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3 }}>{place.name}</div>
          {isAyushman && (
            <div style={{ marginTop: "0.2rem" }}>
              <span style={{
                fontSize: "0.58rem", fontWeight: 700,
                color: "#f59e0b", backgroundColor: "#f59e0b18",
                border: "1px solid #f59e0b40",
                borderRadius: "4px", padding: "0.1rem 0.4rem",
              }}>
                🛡️ Ayushman Empanelled
              </span>
            </div>
          )}
        </div>
        {place.opening_hours && (
          <span style={{ fontSize: "0.6rem", color: isOpen ? "#4ade80" : "#f87171", flexShrink: 0, backgroundColor: isOpen ? "#22c55e15" : "#ef444415", borderRadius: "3px", padding: "0.1rem 0.35rem" }}>
            {isOpen ? "Open" : "Closed"}
          </span>
        )}
      </div>
      {address && <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "0.3rem", lineHeight: 1.4 }}>📍 {address}</div>}
      {phone   && <div style={{ fontSize: "0.68rem", color: "#2dd4bf", marginBottom: "0.3rem" }}>📞 <a href={`tel:${phone}`} style={{ color: "#2dd4bf", textDecoration: "none" }}>{phone}</a></div>}
      {place.rating && (
        <div style={{ fontSize: "0.63rem", color: "#eab308", marginBottom: "0.35rem" }}>
          {"★".repeat(Math.round(place.rating))}{"☆".repeat(Math.max(0, 5 - Math.round(place.rating)))}
          <span style={{ color: "#475569" }}> {place.rating.toFixed(1)}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", backgroundColor: color + "20", border: `1px solid ${color}40`, color, borderRadius: "5px", padding: "0.3rem 0.5rem", fontSize: "0.68rem", fontWeight: 600, textDecoration: "none" }}>
          Directions ↗
        </a>
        {phone && (
          <a href={`tel:${phone}`} style={{ flex: 1, textAlign: "center", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "5px", padding: "0.3rem 0.5rem", fontSize: "0.68rem", fontWeight: 600, textDecoration: "none" }}>
            Call
          </a>
        )}
      </div>
    </div>
  );
}
