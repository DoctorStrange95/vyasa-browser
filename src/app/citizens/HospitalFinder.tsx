"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AB_SPECIALITIES, ABSpeciality } from "@/data/ab-specialities";

interface StateItem { stateSlug: string; stateName: string; count: number; }
interface HospitalRow {
  name: string; district: string; specialities: string;
  address: string; phone: string; type: string; status: string;
}
interface SearchResult {
  hospitals: HospitalRow[]; districts: string[];
  total: number; page: number; pages: number;
  stateName?: string; importedAt?: string;
}

const PINNED_KEY = "hf_pinned_states_v1";

function readPinned(): string[] {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? "[]"); } catch { return []; }
}
function writePinned(slugs: string[]) {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(slugs)); } catch {}
}

const CATEGORY_COLORS: Record<ABSpeciality["category"], string> = {
  Surgical:       "#3b82f6",
  Medical:        "#14b8a6",
  Investigations: "#8b5cf6",
  Other:          "#64748b",
};

function SpecialityBadge({ code }: { code: string }) {
  const clean = code.trim().toUpperCase();
  const sp = AB_SPECIALITIES.find((s) => s.code === clean);
  const color = sp ? CATEGORY_COLORS[sp.category] : "#64748b";
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}44`, fontSize: "0.72rem", padding: "3px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
      <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>{clean}</span>
      {sp && <span style={{ opacity: 0.85, fontWeight: 400 }}>{sp.name}</span>}
    </span>
  );
}

function parseSpecialities(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;\s\/]+/).map((s) => s.trim()).filter(Boolean);
}

// Try to extract a state slug from a free-text place string like "Patna, Bihar" or "Mumbai"
function matchStateFromText(text: string, states: StateItem[]): StateItem | null {
  if (!text) return null;
  const parts = text.split(",").map(p => p.trim()).reverse(); // last part first — most likely the state
  for (const part of parts) {
    if (!part) continue;
    const low = part.toLowerCase();
    const match = states.find(s =>
      s.stateName.toLowerCase().includes(low.split(" ")[0]) ||
      low.includes(s.stateName.toLowerCase().split(" ")[0])
    );
    if (match) return match;
  }
  return null;
}

export default function HospitalFinder({ isLoggedIn, prefilledState, onPrefilledUsed }: { isLoggedIn: boolean; prefilledState?: string; onPrefilledUsed?: () => void }) {
  const [states,           setStates]           = useState<StateItem[]>([]);
  const [selectedState,    setSelectedState]    = useState("");
  const [districts,        setDistricts]        = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSpec,     setSelectedSpec]     = useState("");
  const [searchText,       setSearchText]       = useState("");
  const [result,           setResult]           = useState<SearchResult | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [page,             setPage]             = useState(0);
  const [geoStatus,        setGeoStatus]        = useState<"idle"|"loading"|"done"|"error">("idle");
  const [pinnedSlugs,      setPinnedSlugs]      = useState<string[]>([]);
  const [autoSource,       setAutoSource]       = useState<"profile"|"pinned"|"geo"|null>(null);

  // Load states + auto-detect from profile (if logged in) on mount
  useEffect(() => {
    fetch("/api/citizens/hospitals?states=true")
      .then(r => r.json())
      .then(async (data: StateItem[]) => {
        if (!Array.isArray(data)) return;
        setStates(data);
        setPinnedSlugs(readPinned());

        if (isLoggedIn) {
          try {
            const user = await fetch("/api/citizens/me").then(r => r.ok ? r.json() : null);
            if (user?.place) {
              const match = matchStateFromText(user.place, data);
              if (match) {
                setSelectedState(match.stateSlug);
                setAutoSource("profile");
                return;
              }
            }
          } catch { /* ignore */ }
        }

        // Fall back to first pinned state if available
        const pinned = readPinned();
        if (pinned.length > 0 && data.find(s => s.stateSlug === pinned[0])) {
          setSelectedState(pinned[0]);
          setAutoSource("pinned");
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Apply externally prefilled state (e.g. from pinned card ayushman click)
  useEffect(() => {
    if (!prefilledState || !states.length) return;
    const nameLow = prefilledState.toLowerCase();
    const match = states.find(s => s.stateName.toLowerCase() === nameLow)
      ?? states.find(s => s.stateName.toLowerCase().includes(nameLow.split(/\s+/)[0]));
    if (match) {
      setSelectedState(match.stateSlug);
      setSelectedDistrict("");
      setSelectedSpec("");
      setPage(0);
      setAutoSource(null);
      onPrefilledUsed?.();
    }
  }, [prefilledState, states]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (state: string, district: string, spec: string, q: string, pg: number) => {
    if (!state) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ state, page: String(pg) });
      if (district) params.set("district", district);
      if (spec)     params.set("speciality", spec);
      if (q)        params.set("q", q);
      const r = await fetch(`/api/citizens/hospitals?${params}`);
      const data: SearchResult = await r.json();
      setResult(data);
      if (pg === 0 && data.districts) setDistricts(data.districts);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedState) { setResult(null); setDistricts([]); return; }
    const t = setTimeout(() => doSearch(selectedState, selectedDistrict, selectedSpec, searchText, page), 300);
    return () => clearTimeout(t);
  }, [selectedState, selectedDistrict, selectedSpec, searchText, page, doSearch]);

  const handleStateChange = (slug: string) => {
    setSelectedState(slug);
    setSelectedDistrict("");
    setSelectedSpec("");
    setPage(0);
    setDistricts([]);
    setResult(null);
    setAutoSource(null);
  };

  function togglePin(slug: string) {
    const current = readPinned();
    const next = current.includes(slug)
      ? current.filter(s => s !== slug)
      : [slug, ...current].slice(0, 5);
    writePinned(next);
    setPinnedSlugs(next);
  }

  const handleNearby = () => {
    if (!navigator.geolocation) { setGeoStatus("error"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
            { headers: { "User-Agent": "Vyasa/2.0" } }
          ).then(r => r.json());
          const rawState    = geo?.address?.state ?? "";
          const rawDistrict = (geo?.address?.county ?? geo?.address?.state_district ?? "").replace(/\s+district$/i, "").trim();
          const matchState  = states.find(s =>
            s.stateName.toLowerCase().includes(rawState.toLowerCase().split(" ")[0]) ||
            rawState.toLowerCase().includes(s.stateName.toLowerCase().split(" ")[0])
          );
          if (matchState) {
            setSelectedState(matchState.stateSlug);
            setAutoSource("geo");
            if (rawDistrict) {
              const r = await fetch(`/api/citizens/hospitals?state=${matchState.stateSlug}`);
              const data: SearchResult = await r.json();
              if (data.districts) {
                setDistricts(data.districts);
                const matchDist = data.districts.find(d =>
                  d.toLowerCase().includes(rawDistrict.toLowerCase().split(" ")[0]) ||
                  rawDistrict.toLowerCase().includes(d.toLowerCase().split(" ")[0])
                );
                if (matchDist) setSelectedDistrict(matchDist);
              }
            }
          }
          setGeoStatus("done");
        } catch { setGeoStatus("error"); }
      },
      () => setGeoStatus("error"),
      { timeout: 8000, maximumAge: 30000 }
    );
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px",
    border: "1px solid #1e3a5f", background: "#060e1c", color: "#e2e8f0",
    fontSize: "0.92rem", outline: "none", fontFamily: "inherit",
    minHeight: "44px",
  };

  const selectedStateName = states.find(s => s.stateSlug === selectedState)?.stateName;
  const isPinned = pinnedSlugs.includes(selectedState);

  return (
    <div>
      {/* Search card */}
      <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.5rem" }}>

        {/* Section intro */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🛡️</span>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Find Ayushman Bharat Hospitals</h2>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            Search {states.length > 0 ? `across ${states.reduce((a,s)=>a+s.count,0).toLocaleString("en-IN")} empanelled hospitals` : "NHA AB-PMJAY empanelled hospitals"} — cashless treatment available under PM-JAY
          </p>
        </div>

      {/* My States quick-chips */}
      {pinnedSlugs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.72rem", color: "#64748b", flexShrink: 0, fontWeight: 600 }}>📌 My States:</span>
          {pinnedSlugs.map(slug => {
            const st = states.find(s => s.stateSlug === slug);
            if (!st) return null;
            return (
              <button
                key={slug}
                onClick={() => handleStateChange(slug)}
                style={{
                  background: selectedState === slug ? "#0d9488" : "#0a1628",
                  border: `1px solid ${selectedState === slug ? "#0d9488" : "#1e3a5f"}`,
                  color: selectedState === slug ? "#fff" : "#94a3b8",
                  borderRadius: "20px", padding: "0.2rem 0.75rem",
                  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {st.stateName}
              </button>
            );
          })}
        </div>
      )}

      {/* Auto-source label */}
      {autoSource && selectedState && (
        <div style={{ marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", color: autoSource === "profile" ? "#22c55e" : autoSource === "pinned" ? "#0d9488" : "#60a5fa", background: autoSource === "profile" ? "#14532d30" : autoSource === "pinned" ? "#0d948820" : "#1e3a5f30", borderRadius: "5px", padding: "0.25rem 0.65rem", fontWeight: 500 }}>
            {autoSource === "profile" ? "✓ State auto-filled from your profile" : autoSource === "pinned" ? "📌 Loaded from My States" : "📍 Location detected"}
          </span>
          <button
            onClick={() => togglePin(selectedState)}
            style={{ fontSize: "0.78rem", color: isPinned ? "#f97316" : "#64748b", background: "transparent", border: "1px solid #1e3a5f", borderRadius: "5px", padding: "0.25rem 0.65rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            {isPinned ? "📌 Pinned" : "📌 Pin this state"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="hf-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>State</label>
          <select style={inp} value={selectedState} onChange={e => handleStateChange(e.target.value)}>
            <option value="">Select state…</option>
            {states.map(s => (
              <option key={s.stateSlug} value={s.stateSlug}>{s.stateName} ({s.count})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>District</label>
          <select style={inp} value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setPage(0); }} disabled={!selectedState}>
            <option value="">All districts</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Speciality</label>
          <select style={inp} value={selectedSpec} onChange={e => { setSelectedSpec(e.target.value); setPage(0); }}>
            <option value="">All specialities</option>
            {AB_SPECIALITIES.map(s => (
              <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Search hospital</label>
          <input
            style={inp}
            placeholder="Hospital name…"
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Nearby button + pin helper */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
        <button
          onClick={handleNearby}
          disabled={geoStatus === "loading"}
          style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #3b82f660", borderRadius: "8px", padding: "0.65rem 1.25rem", fontSize: "0.88rem", fontWeight: 600, cursor: geoStatus === "loading" ? "wait" : "pointer", fontFamily: "inherit", minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          {geoStatus === "loading" ? "📡 Detecting…" : "📍 Use my location"}
        </button>

        {!isLoggedIn && (
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Sign in to auto-fill state from your profile
          </span>
        )}
        {isLoggedIn && !selectedState && (
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Add your city in <strong style={{ color: "#60a5fa" }}>Profile → Edit Profile</strong> to auto-detect
          </span>
        )}

        {geoStatus === "error" && (
          <span style={{ fontSize: "0.82rem", color: "#f87171" }}>
            ✕ Could not detect location — please select manually
          </span>
        )}
        {geoStatus === "done" && (
          <span style={{ fontSize: "0.82rem", color: "#4ade80" }}>
            ✓ Location detected
          </span>
        )}
      </div>
      </div>{/* end search card */}

      {/* Results */}
      {loading && (
        <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
          <div style={{ fontSize: "0.88rem", color: "#64748b", marginBottom: "0.2rem" }}>Please wait, searching Ayushman Bharat empanelled hospitals…</div>
          <div style={{ fontSize: "0.72rem", color: "#334155" }}>Querying AB-PMJAY database · This may take a moment</div>
        </div>
      )}

      {!loading && result && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.88rem", color: "#94a3b8", fontWeight: 500 }}>
                <strong style={{ color: "#e2e8f0" }}>{result.total.toLocaleString("en-IN")}</strong> hospital{result.total !== 1 ? "s" : ""} found
                {result.stateName ? ` in ${result.stateName}` : ""}
                {result.page > 0 ? ` · page ${result.page + 1} of ${result.pages}` : ""}
              </span>
              {/* Pin button in results area too */}
              {selectedState && !autoSource && (
                <button
                  onClick={() => togglePin(selectedState)}
                  style={{ fontSize: "0.7rem", color: isPinned ? "#f97316" : "#475569", background: "transparent", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "0.15rem 0.5rem", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {isPinned ? "📌 Pinned" : `📌 Pin ${selectedStateName}`}
                </button>
              )}
            </div>
            {result.pages > 1 && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button disabled={result.page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: "0.55rem 1rem", borderRadius: "7px", border: "1px solid #1e3a5f", background: "#0d1f3c", color: "#93c5fd", fontSize: "0.85rem", cursor: result.page === 0 ? "default" : "pointer", fontFamily: "inherit", minHeight: "44px", opacity: result.page === 0 ? 0.4 : 1 }}>← Prev</button>
                <button disabled={result.page >= result.pages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: "0.55rem 1rem", borderRadius: "7px", border: "1px solid #1e3a5f", background: "#0d1f3c", color: "#93c5fd", fontSize: "0.85rem", cursor: result.page >= result.pages - 1 ? "default" : "pointer", fontFamily: "inherit", minHeight: "44px", opacity: result.page >= result.pages - 1 ? 0.4 : 1 }}>Next →</button>
              </div>
            )}
          </div>

          {result.hospitals.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#475569", fontSize: "0.88rem", border: "1px solid #1e3a5f", borderRadius: "10px" }}>
              No hospitals found for the selected filters.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {result.hospitals.map((h, i) => (
                <div key={i} style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                        <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.95rem", lineHeight: 1.3 }}>
                          {h.name || "—"}
                        </div>
                        {h.type && <span style={{ fontSize: "0.68rem", color: "#64748b", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "0.1rem 0.4rem", flexShrink: 0 }}>{h.type}</span>}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.4rem" }}>
                        {[h.district, h.address].filter(Boolean).join(" · ")}
                      </div>
                      {h.specialities && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "0.35rem" }}>
                          {parseSpecialities(h.specialities).slice(0, 20).map(code => (
                            <SpecialityBadge key={code} code={code} />
                          ))}
                          {parseSpecialities(h.specialities).length > 20 && (
                            <span style={{ fontSize: "0.65rem", color: "#64748b" }}>
                              +{parseSpecialities(h.specialities).length - 20} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {h.phone && isLoggedIn ? (
                        <a href={`tel:${h.phone.replace(/[\s\-]/g, "")}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#166534", color: "#4ade80", border: "1px solid #15803d", borderRadius: "7px", padding: "0.45rem 0.85rem", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                          📞 Register
                        </a>
                      ) : h.phone && !isLoggedIn ? (
                        <Link href="/auth" style={{ display: "inline-flex", fontSize: "0.75rem", color: "#475569", border: "1px dashed #1e3a5f", borderRadius: "6px", padding: "0.35rem 0.6rem", textDecoration: "none", whiteSpace: "nowrap" }}>
                          Sign in to call
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.importedAt && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#334155" }}>
              Data imported {new Date(result.importedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Source: NHA AB-PMJAY
            </div>
          )}
        </>
      )}

      {!loading && !result && !selectedState && (
        <div style={{ padding: "3rem 2rem", textAlign: "center", background: "#060e1c", border: "1px solid #1e3a5f", borderRadius: "12px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏥</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.5rem" }}>
            Find a hospital near you
          </div>
          <div style={{ fontSize: "0.88rem", color: "#64748b", lineHeight: 1.65, maxWidth: "400px", margin: "0 auto" }}>
            {isLoggedIn
              ? "Select a state above, or tap \"Use my location\" to auto-detect. Add your city in Profile to enable auto-fill."
              : "Select your state to browse Ayushman Bharat empanelled hospitals — cashless treatment available under PM-JAY for eligible families."}
          </div>
          {!isLoggedIn && (
            <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <a href="/auth" style={{ background: "#0d9488", color: "#fff", padding: "0.6rem 1.25rem", borderRadius: "7px", fontSize: "0.88rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: "44px" }}>
                Sign in to auto-fill state
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
