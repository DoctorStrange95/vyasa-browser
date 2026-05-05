"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Leaderboard from "@/components/Leaderboard";
import PushNotificationSetup from "@/components/PushNotificationSetup";

// ── Types ────────────────────────────────────────────────────────────────────
interface AyushmanState { stateSlug: string; stateName: string; count: number; }

interface StateStat {
  slug: string; name: string; healthScore: number; rank: number;
  imr: number | null; vaccinationPct: number | null;
  institutionalBirthsPct: number | null; stuntingPct: number | null;
  birthRate2023: number | null; deathRate2023: number | null;
  womenAnaemiaPct?: number | null; neonatalMR?: number | null; under5MR?: number | null;
  totalStates?: number;
  district?: { slug: string; name: string; aqi?: number; aqiLabel?: string } | null;
}

interface LocationCtx {
  city: string; district: string; state: string;
  lat: number; lon: number;
}

interface IDSPOutbreak {
  state: string; district: string; disease: string;
  cases: number; deaths: number; status: string; week: number; year: number;
}

interface IntelItem {
  title: string; summary: string; disease: string; date: string;
  source: string; sourceUrl?: string;
  location: { state: string; district: string; village: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function weekToDateRange(week: number, year: number): string {
  const w = week > 0 ? week : (() => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const w1 = new Date(jan4);
    w1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    return Math.ceil((now.getTime() - w1.getTime()) / (7 * 86400000)) + 1;
  })();
  const y = week > 0 ? year : new Date().getFullYear();
  const jan4 = new Date(y, 0, 4);
  const w1 = new Date(jan4);
  w1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(w1);
  start.setDate(w1.getDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `W${w} · ${fmt(start)}–${fmt(end)}`;
}

function scoreColor(v: number) {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

function aqiColor(label?: string) {
  if (!label) return "#64748b";
  const l = label.toLowerCase();
  if (l.includes("good"))       return "#22c55e";
  if (l.includes("satisf"))     return "#84cc16";
  if (l.includes("moderate"))   return "#eab308";
  if (l.includes("poor"))       return "#f97316";
  if (l.includes("very poor") || l.includes("severe")) return "#ef4444";
  return "#64748b";
}

function Metric({ label, value, unit, sub }: { label: string; value: string | number | null | undefined; unit?: string; sub?: string }) {
  return (
    <div style={{ background: "#060e1c", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.85rem 1rem" }}>
      <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.04em", marginBottom: "0.35rem", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.15 }}>
        {value != null ? value : "—"}
        {value != null && unit && <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "3px" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.25rem" }}>{sub}</div>}
    </div>
  );
}

function pinnedKey(uid: string) { return `hfi_pins_${uid}`; }

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();

  const [ayushmanStates, setAyushmanStates] = useState<AyushmanState[]>([]);
  const [allStats,       setAllStats]       = useState<StateStat[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [detected,       setDetected]       = useState<StateStat | null>(null);
  const [geoStatus,      setGeoStatus]      = useState<"idle"|"detecting"|"done"|"error">("idle");
  const [search,         setSearch]         = useState("");
  const [showAll,        setShowAll]        = useState(false);
  const [manualState,    setManualState]    = useState("");
  const [manualSuggestions, setManualSuggestions] = useState<StateStat[]>([]);
  const [pinnedSlugs,    setPinnedSlugs]    = useState<string[]>([]);
  const [pinnedKey_,     setPinnedKey_]     = useState<string>("hfi_pins_anon");
  const [pinnedStats,    setPinnedStats]    = useState<StateStat[]>([]);
  const [locationCtx,    setLocationCtx]    = useState<LocationCtx | null>(null);
  const [localOutbreaks, setLocalOutbreaks] = useState<IDSPOutbreak[]>([]);
  const [localIntel,     setLocalIntel]     = useState<IntelItem[]>([]);
  const [intelIsLocal,   setIntelIsLocal]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/citizens/hospitals?states=true").then(r => r.json()),
      fetch("/api/citizens/state-stats").then(r => r.json()),
      fetch("/api/citizens/me").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([ayush, stats, me]) => {
      // Auth guard — dashboard requires login
      if (!me || me.error) { router.replace("/auth?next=/dashboard"); return; }

      const statsList: StateStat[] = Array.isArray(stats) ? stats : [];
      setAyushmanStates(Array.isArray(ayush) ? ayush : []);
      setAllStats(statsList);

      // Use Firestore as source of truth; UID-namespaced local key is just a cache
      const firestorePins: string[] = Array.isArray(me.pinnedStates) ? me.pinnedStates : [];
      const localKey = pinnedKey(me.uid ?? me.email ?? "anon");
      setPinnedKey_(localKey);
      const localCache = (() => { try { const s = localStorage.getItem(localKey); return s ? (JSON.parse(s) as string[]) : null; } catch { return null; } })();
      // If Firestore has data use it; else fall back to local cache (first login)
      const pins = firestorePins.length > 0 ? firestorePins : (localCache ?? []);
      setPinnedSlugs(pins);
      try { localStorage.setItem(localKey, JSON.stringify(pins)); } catch { /* ignore */ }

      if (me?.place && statsList.length) {
        const parts = (me.place as string).split(",").map((p: string) => p.trim()).reverse();
        let match: StateStat | undefined;
        for (const part of parts) {
          const low = part.toLowerCase().trim();
          match =
            statsList.find(s => s.name.toLowerCase() === low) ??
            statsList.find(s => low.startsWith(s.name.toLowerCase())) ??
            statsList.find(s => s.name.toLowerCase().startsWith(low)) ??
            statsList.find(s => low.includes(s.name.toLowerCase()) && s.name.length > 6) ??
            statsList.find(s => s.name.toLowerCase().includes(low) && low.length > 6);
          if (match) break;
        }
        if (match) {
          fetch(`/api/citizens/state-stats?state=${match.slug}`)
            .then(r => r.json())
            .then(d => setDetected(d))
            .catch(() => {});
        }
      }
    }).catch(() => router.replace("/auth?next=/dashboard")).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!pinnedSlugs.length || !allStats.length) return;
    const missing = pinnedSlugs.filter(slug => !pinnedStats.find(s => s.slug === slug));
    if (!missing.length) return;
    Promise.all(
      missing.map(slug => fetch(`/api/citizens/state-stats?state=${slug}`).then(r => r.json()).catch(() => null))
    ).then(results => {
      setPinnedStats(prev => [...prev, ...(results.filter(Boolean) as StateStat[])]);
    });
  }, [pinnedSlugs, allStats]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stateName = locationCtx?.state ?? detected?.name ?? null;
    if (!stateName) return;

    const stateWords = stateName.toLowerCase().split(/\s+/);
    function stateMatches(outbreakState: string) {
      const low = outbreakState.toLowerCase();
      return stateWords.every(w => low.includes(w));
    }

    const keywords = locationCtx
      ? [locationCtx.city, locationCtx.district, locationCtx.state]
          .map(s => s.toLowerCase().trim()).filter(s => s.length > 3)
      : stateName.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    fetch("/api/idsp-weekly")
      .then(r => r.json())
      .then(d => {
        const filtered: IDSPOutbreak[] = (d.outbreaks ?? []).filter((o: IDSPOutbreak) =>
          stateMatches(o.state)
        );
        setLocalOutbreaks(filtered.slice(0, 8));
      }).catch(() => {});

    fetch("/api/ph-intelligence")
      .then(r => r.json())
      .then(d => {
        const items: IntelItem[] = d.items ?? [];
        const stateItems = items.filter(item => {
          const haystack = [item.title, item.summary, item.location?.state, item.location?.district, item.location?.village]
            .join(" ").toLowerCase();
          return keywords.some(k => haystack.includes(k));
        });
        const isLocal = stateItems.length >= 2;
        const finalItems = isLocal
          ? stateItems
          : [...stateItems, ...items.filter(i => !stateItems.includes(i))].slice(0, 6);
        setIntelIsLocal(isLocal);
        setLocalIntel(finalItems);
      }).catch(() => {});
  }, [locationCtx, detected]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePin(slug: string) {
    setPinnedSlugs(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      // UID-namespaced local cache + Firestore sync for cross-device persistence
      try { localStorage.setItem(pinnedKey_, JSON.stringify(next)); } catch { /* ignore */ }
      fetch("/api/citizens/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedStates: next }),
      }).catch(() => {});
      if (!prev.includes(slug)) {
        fetch(`/api/citizens/state-stats?state=${slug}`)
          .then(r => r.json())
          .then(data => setPinnedStats(p => [...p.filter(s => s.slug !== slug), data]))
          .catch(() => {});
      } else {
        setPinnedStats(p => p.filter(s => s.slug !== slug));
      }
      return next;
    });
  }

  const detectState = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus("error"); return; }
    setGeoStatus("detecting");
    setLocalOutbreaks([]);
    setLocalIntel([]);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en&zoom=14`,
            { headers: { "User-Agent": "Vyasa/2.0" } }
          ).then(r => r.json());

          const addr = geo?.address ?? {};
          const rawState    = addr.state ?? "";
          const rawDistrict = (addr.county ?? addr.state_district ?? addr.district ?? "").replace(/\s+district$/i, "").trim();
          const rawCity     = addr.city ?? addr.town ?? addr.suburb ?? addr.village ?? addr.hamlet ?? "";

          const rawStateLow = rawState.toLowerCase().trim();
          const matchStat =
            allStats.find(s => s.name.toLowerCase() === rawStateLow) ??
            allStats.find(s => rawStateLow.startsWith(s.name.toLowerCase())) ??
            allStats.find(s => s.name.toLowerCase().startsWith(rawStateLow)) ??
            allStats.find(s => rawStateLow.includes(s.name.toLowerCase()) && s.name.length > 6) ??
            allStats.find(s => s.name.toLowerCase().includes(rawStateLow) && rawStateLow.length > 6);
          if (!matchStat) { setGeoStatus("done"); return; }

          setLocationCtx({ city: rawCity, district: rawDistrict, state: rawState, lat, lon });
          const params = new URLSearchParams({ state: matchStat.slug });
          if (rawDistrict) params.set("district", rawDistrict);
          const detail: StateStat = await fetch(`/api/citizens/state-stats?${params}`).then(r => r.json());
          setDetected(detail);
          setGeoStatus("done");
        } catch { setGeoStatus("error"); }
      },
      () => setGeoStatus("error"),
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
    );
  }, [allStats]);

  function handleManualInput(val: string) {
    setManualState(val);
    if (val.length < 2) { setManualSuggestions([]); return; }
    const lower = val.toLowerCase();
    setManualSuggestions(allStats.filter(s => s.name.toLowerCase().includes(lower)).slice(0, 6));
  }

  async function selectManualState(s: StateStat) {
    setManualState("");
    setManualSuggestions([]);
    setLocationCtx(null);
    setLocalOutbreaks([]);
    setLocalIntel([]);
    setIntelIsLocal(false);
    const detail: StateStat = await fetch(`/api/citizens/state-stats?state=${s.slug}`).then(r => r.json());
    setDetected(detail);
  }

  function normKey(s: string) { return s.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, ""); }
  const ayushMap: Record<string, number> = {};
  ayushmanStates.forEach(a => {
    ayushMap[a.stateSlug]          = a.count;
    ayushMap[normKey(a.stateSlug)] = a.count;
    ayushMap[normKey(a.stateName)] = a.count;
  });
  function getAyush(slug: string, name?: string): number {
    return ayushMap[slug] ?? ayushMap[normKey(slug)] ?? (name ? ayushMap[normKey(name)] : undefined) ?? 0;
  }

  const totalHospitals = ayushmanStates.reduce((acc, s) => acc + s.count, 0);
  const merged  = allStats.map(s => ({ ...s, ayushCount: getAyush(s.slug, s.name) }));
  const filtered = merged.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted   = [...filtered].sort((a, b) => a.rank - b.rank);
  const orderedPinned = pinnedSlugs.map(slug => pinnedStats.find(s => s.slug === slug)).filter(Boolean) as StateStat[];

  function onFindHospitals(stateName: string) {
    router.push(`/citizens?tab=hospitals&prestate=${encodeURIComponent(stateName)}`);
  }

  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ borderBottom: "1px solid #1e3a5f", padding: "2.5rem 1.5rem 2rem", background: "linear-gradient(180deg, #071830 0%, #070f1e 100%)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "2rem" }}>📊</span>
            <h1 className="font-display" style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.15 }}>
              My Health Dashboard
            </h1>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "1rem", margin: "0 0 0 2.85rem", lineHeight: 1.6 }}>
            Personalised state &amp; district health data · IDSP outbreaks · Disease intelligence · All 36 states
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>

        {/* ── My States Comparison ──────────────────────────────────────── */}
        {orderedPinned.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.88rem" }}>📌 My States Dashboard</div>
              <span style={{ fontSize: "0.65rem", color: "#334155" }}>Pin states to compare</span>
            </div>
            <div style={{
              display: "flex",
              gap: "0.65rem",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              paddingBottom: "0.25rem",
              scrollbarWidth: "none",
            }}>
              {orderedPinned.map(s => {
                const ayushCount = getAyush(s.slug, s.name);
                return (
                  <div key={s.slug} style={{ background: "#071428", border: `1px solid ${s.slug === detected?.slug ? "#3b82f680" : "#1e3a5f"}`, borderRadius: "12px", padding: "0.9rem 1rem", position: "relative", display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "min(260px, 80vw)", flexShrink: 0, scrollSnapAlign: "start" }}>
                    <button onClick={e => { e.stopPropagation(); togglePin(s.slug); }} style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.75rem", padding: "0.1rem 0.3rem" }} title="Remove">✕</button>
                    <button style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={() => setDetected(s)}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: `3px solid ${scoreColor(s.healthScore)}`, display: "flex", alignItems: "center", justifyContent: "center", background: "#060e1c", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: scoreColor(s.healthScore) }}>{s.healthScore}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.1 }}>{s.name}</div>
                        <div style={{ fontSize: "0.62rem", color: "#475569" }}>Rank #{s.rank}</div>
                      </div>
                    </button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
                      {s.imr != null && <div style={{ background: "#060e1c", borderRadius: "6px", padding: "0.3rem 0.5rem" }}><div style={{ fontSize: "0.6rem", color: "#475569" }}>IMR</div><div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>{s.imr}</div></div>}
                      {s.vaccinationPct != null && <div style={{ background: "#060e1c", borderRadius: "6px", padding: "0.3rem 0.5rem" }}><div style={{ fontSize: "0.6rem", color: "#475569" }}>Vacc.</div><div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>{s.vaccinationPct}%</div></div>}
                      {s.stuntingPct != null && <div style={{ background: "#060e1c", borderRadius: "6px", padding: "0.3rem 0.5rem" }}><div style={{ fontSize: "0.6rem", color: "#475569" }}>Stunting</div><div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>{s.stuntingPct}%</div></div>}
                      {s.birthRate2023 != null && <div style={{ background: "#060e1c", borderRadius: "6px", padding: "0.3rem 0.5rem" }}><div style={{ fontSize: "0.6rem", color: "#475569" }}>Birth Rate</div><div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>{s.birthRate2023}</div></div>}
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", paddingTop: "0.35rem", borderTop: "1px solid #1e3a5f", flexWrap: "wrap" }}>
                      {ayushCount > 0 && (
                        <button onClick={() => onFindHospitals(s.name)} style={{ all: "unset", cursor: "pointer", background: "#1a120080", border: "1px solid #f59e0b40", borderRadius: "5px", padding: "0.2rem 0.55rem", display: "flex", alignItems: "center", gap: "0.3rem" }} title={`Find empanelled hospitals in ${s.name}`}>
                          <span style={{ fontSize: "0.62rem", color: "#92400e" }}>🛡️</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f59e0b" }}>{ayushCount.toLocaleString("en-IN")}</span>
                          <span style={{ fontSize: "0.62rem", color: "#78350f" }}>hospitals →</span>
                        </button>
                      )}
                      <Link href={`/state/${s.slug}`} style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>Full stats →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── My State & District card ──────────────────────────────────── */}
        <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.95rem" }}>📍 My State &amp; District</div>
            {geoStatus !== "detecting" && (
              <button onClick={detectState} disabled={loading} style={{ background: "#0f2040", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: "7px", padding: "0.3rem 0.85rem", fontSize: "0.78rem", cursor: loading ? "wait" : "pointer" }}>
                {detected ? "🔄 Re-detect" : "📍 Detect my location"}
              </button>
            )}
            {geoStatus === "detecting" && <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Detecting location…</span>}
          </div>

          {detected ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{detected.name}</div>
                    <button onClick={() => togglePin(detected.slug)} style={{ fontSize: "0.72rem", fontWeight: 600, color: pinnedSlugs.includes(detected.slug) ? "#fbbf24" : "#64748b", background: pinnedSlugs.includes(detected.slug) ? "#1a1200" : "#0f2040", border: `1px solid ${pinnedSlugs.includes(detected.slug) ? "#fbbf2440" : "#1e3a5f"}`, borderRadius: "5px", padding: "0.2rem 0.55rem", cursor: "pointer" }}>
                      {pinnedSlugs.includes(detected.slug) ? "📌 Pinned" : "📌 Pin"}
                    </button>
                    <button onClick={() => { setDetected(null); setLocationCtx(null); setLocalOutbreaks([]); setLocalIntel([]); }} style={{ fontSize: "0.65rem", color: "#475569", background: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "0.1rem 0.45rem", cursor: "pointer" }}>
                      ✎ Not your state?
                    </button>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.2rem" }}>STATE HEALTH DASHBOARD · INDIA</div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.62rem", color: "#22c7bb", border: "1px solid #22c7bb40", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>SRS 2023</span>
                    <span style={{ fontSize: "0.62rem", color: "#60a5fa", border: "1px solid #60a5fa40", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>NFHS-5 2019–21</span>
                    <span style={{ fontSize: "0.62rem", color: "#f59e0b", border: "1px solid #f59e0b40", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>AB-PMJAY</span>
                  </div>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: `4px solid ${scoreColor(detected.healthScore)}`, display: "flex", alignItems: "center", justifyContent: "center", background: "#060e1c" }}>
                    <span style={{ fontSize: "1.3rem", fontWeight: 800, color: scoreColor(detected.healthScore) }}>{detected.healthScore}</span>
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "#475569", marginTop: "0.3rem" }}>Health Score</div>
                  <div style={{ fontSize: "0.6rem", color: "#64748b" }}>Rank #{detected.rank} / {detected.totalStates ?? allStats.length}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "0.85rem" }}>
                <Metric label="IMR (SRS 2023)" value={detected.imr} unit="/1k LB" sub="Infant Mortality Rate" />
                <Metric label="VACCINATION" value={detected.vaccinationPct != null ? `${detected.vaccinationPct}%` : null} sub="Full coverage" />
                <Metric label="INST. BIRTHS" value={detected.institutionalBirthsPct != null ? `${detected.institutionalBirthsPct}%` : null} sub="Facility deliveries" />
                <Metric label="STUNTING" value={detected.stuntingPct != null ? `${detected.stuntingPct}%` : null} sub="Children" />
                <Metric label="BIRTH RATE" value={detected.birthRate2023} unit="/1k pop" sub="SRS 2023" />
                <Metric label="DEATH RATE" value={detected.deathRate2023} unit="/1k pop" sub="SRS 2023" />
              </div>

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => onFindHospitals(detected.name)}
                  style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: "140px", background: "#060e1c", border: "1px solid #f59e0b40", borderRadius: "8px", padding: "0.65rem 0.85rem", display: "block" }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 600, letterSpacing: "0.04em" }}>🛡️ AYUSHMAN EMPANELLED</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.25rem" }}>{getAyush(detected.slug, detected.name).toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.15rem" }}>hospitals in {detected.name} — click to find →</div>
                </button>

                {detected.district && (
                  <Link href={`/district/${detected.district.slug}`} style={{ flex: 1, minWidth: "140px", background: "#060e1c", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.65rem 0.85rem", textDecoration: "none", display: "block" }}>
                    <div style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 600, letterSpacing: "0.04em" }}>📍 YOUR DISTRICT</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", marginTop: "0.25rem" }}>{detected.district.name}</div>
                    {detected.district.aqi != null && (
                      <div style={{ fontSize: "0.75rem", color: aqiColor(detected.district.aqiLabel), marginTop: "0.2rem" }}>
                        AQI {detected.district.aqi} · {detected.district.aqiLabel}
                      </div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#3b82f6", marginTop: "0.35rem" }}>View district dashboard →</div>
                  </Link>
                )}
              </div>

              <Link href={`/state/${detected.slug}`} style={{ display: "block", marginTop: "0.85rem", textAlign: "center", background: "#0f2040", border: "1px solid #3b82f660", color: "#93c5fd", borderRadius: "8px", padding: "0.55rem", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                View full {detected.name} health dashboard →
              </Link>
            </>
          ) : (
            <div>
              <div style={{ fontSize: "0.85rem", color: "#475569", padding: "0.35rem 0 0.75rem" }}>
                {geoStatus === "error" ? "Could not auto-detect. Type your state below." : "Tap 'Detect my location' or type your state name below."}
              </div>
              <div style={{ position: "relative" }}>
                <input value={manualState} onChange={e => handleManualInput(e.target.value)} placeholder="Type state name, e.g. Kerala, Maharashtra…"
                  style={{ width: "100%", background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "7px", color: "#e2e8f0", fontSize: "0.82rem", padding: "0.45rem 0.75rem", outline: "none", boxSizing: "border-box" }} />
                {manualSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "7px", zIndex: 20, overflow: "hidden", boxShadow: "0 4px 12px #00000060" }}>
                    {manualSuggestions.map(s => (
                      <button key={s.slug} onMouseDown={() => selectManualState(s)}
                        style={{ display: "flex", alignItems: "center", gap: "0.6rem", width: "100%", textAlign: "left", padding: "0.5rem 0.85rem", fontSize: "0.82rem", color: "#94a3b8", background: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid #0a1628", fontFamily: "inherit" }}>
                        <span style={{ width: "28px", height: "28px", borderRadius: "50%", border: `2px solid ${scoreColor(s.healthScore)}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: scoreColor(s.healthScore), flexShrink: 0 }}>{s.healthScore}</span>
                        <span>{s.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#334155" }}>Rank #{s.rank}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #1e3a5f", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fbbf24" }}>{totalHospitals.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Total AB-PMJAY empanelled across India</div>
            </div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#60a5fa" }}>{allStats.length || "36"}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>States &amp; Union Territories</div>
            </div>
          </div>
        </div>

        {/* ── Personalised Feed ────────────────────────────────────────── */}
        {(locationCtx || detected) && (
          <div style={{ marginBottom: "1.25rem" }}>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem", background: "#071428", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.75rem 1rem" }}>
              <span style={{ fontSize: "1rem" }}>📍</span>
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
                {locationCtx?.city && <><span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0" }}>{locationCtx.city}</span><span style={{ color: "#1e3a5f" }}>·</span></>}
                {locationCtx?.district && <><span style={{ fontSize: "0.88rem", color: "#94a3b8" }}>{locationCtx.district}</span><span style={{ color: "#1e3a5f" }}>·</span></>}
                <span style={{ fontSize: "0.88rem", color: "#94a3b8" }}>{locationCtx?.state ?? detected?.name}</span>
              </div>
              <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#334155", background: "#0a1628", borderRadius: "4px", padding: "0.15rem 0.5rem", border: "1px solid #1e3a5f" }}>{locationCtx ? "GPS" : "SELECTED"}</span>
            </div>

            {localOutbreaks.length > 0 && (
              <div style={{ background: "#071428", border: "1px solid #ef444440", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <span style={{ fontSize: "1rem" }}>🦠</span>
                  <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: "0.88rem" }}>Disease Surveillance · {locationCtx?.state ?? detected?.name}</div>
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#64748b", background: "#0a1628", borderRadius: "4px", padding: "0.1rem 0.4rem", border: "1px solid #1e3a5f" }}>IDSP</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {localOutbreaks.map((o, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "#060e1c", borderRadius: "8px", padding: "0.6rem 0.85rem", borderLeft: "3px solid #ef444460" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fca5a5" }}>{o.disease}</div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>
                          {o.district ? `${o.district}, ` : ""}{o.state} &nbsp;·&nbsp; {weekToDateRange(o.week, o.year)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fca5a5" }}>{o.cases} cases</div>
                        {o.deaths > 0 && <div style={{ fontSize: "0.68rem", color: "#ef4444" }}>{o.deaths} deaths</div>}
                        <div style={{ fontSize: "0.6rem", color: o.status === "active" ? "#fbbf24" : "#22c55e", marginTop: "0.1rem", textTransform: "capitalize" }}>{o.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {localIntel.length > 0 && (
              <div style={{ background: "#071428", border: "1px solid #3b82f640", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <span style={{ fontSize: "1rem" }}>📡</span>
                  <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.88rem" }}>
                    {intelIsLocal ? `Health Intelligence · ${locationCtx?.state ?? detected?.name}` : "National Health Intelligence"}
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#64748b", background: "#0a1628", borderRadius: "4px", padding: "0.1rem 0.4rem", border: "1px solid #1e3a5f" }}>
                    {intelIsLocal ? "LOCAL" : "NATIONAL"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {localIntel.map((item, i) => (
                    <div key={i} style={{ background: "#060e1c", borderRadius: "8px", padding: "0.7rem 0.9rem", borderLeft: "3px solid #3b82f660" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#93c5fd", lineHeight: 1.3, marginBottom: "0.25rem" }}>{item.title}</div>
                          {item.summary && (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {item.summary}
                            </div>
                          )}
                          <div style={{ fontSize: "0.65rem", color: "#334155", marginTop: "0.35rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {item.disease && <span style={{ color: "#fbbf2480" }}>{item.disease}</span>}
                            {item.location?.district && <span>{item.location.district}</span>}
                            {item.date && <span>{item.date}</span>}
                            {item.source && <span style={{ color: "#475569" }}>· {item.source}</span>}
                          </div>
                        </div>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, fontSize: "0.7rem", color: "#475569", marginLeft: "0.5rem", textDecoration: "none" }}>↗</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locationCtx?.district && (
              <Link href={`/district/${locationCtx.district.toLowerCase().trim().replace(/\s+/g, "-")}`}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#071428", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.65rem 1rem", textDecoration: "none", marginBottom: "0.85rem" }}>
                <span style={{ fontSize: "0.9rem" }}>🗺️</span>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>View {locationCtx.district} District Dashboard</div>
                  <div style={{ fontSize: "0.68rem", color: "#475569", marginTop: "0.1rem" }}>AQI, local health data, nearby facilities</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#3b82f6", fontSize: "0.8rem" }}>→</span>
              </Link>
            )}

            {localOutbreaks.length === 0 && localIntel.length === 0 && (
              <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.85rem 1rem", fontSize: "0.82rem", color: "#475569" }}>
                No active outbreaks or health alerts found for {locationCtx?.state ?? detected?.name}. Your region looks clear.
              </div>
            )}
          </div>
        )}

        {/* ── Leaderboard ─────────────────────────────────────────────── */}
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "0.25rem" }}>
              Community Surveillance Leaderboard
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Top contributors for IDSP disease tracking
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <PushNotificationSetup state={detected?.name} />
          </div>
          <Leaderboard stateFilter={detected?.name} maxRows={10} />
        </div>

        {/* ── All States grid ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
          <div style={{ fontWeight: 600, color: "#94a3b8", fontSize: "0.78rem", letterSpacing: "0.06em" }}>ALL STATES &amp; UNION TERRITORIES</div>
          <span style={{ fontSize: "0.65rem", color: "#334155" }}>sorted by health rank</span>
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setShowAll(false); }} placeholder="Search state or UT…"
          style={{ width: "100%", background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "7px", color: "#e2e8f0", fontSize: "0.82rem", padding: "0.45rem 0.75rem", outline: "none", marginBottom: "0.65rem", boxSizing: "border-box" }} />

        {loading ? (
          <div style={{ color: "#475569", textAlign: "center", padding: "2.5rem 1rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
            <div style={{ fontSize: "0.88rem", color: "#64748b", marginBottom: "0.25rem" }}>Please wait, fetching state health data…</div>
            <div style={{ fontSize: "0.72rem", color: "#334155" }}>Loading NFHS-5 · SRS 2023 · AB-PMJAY data for all 36 states &amp; UTs</div>
          </div>
        ) : (() => {
          const PREVIEW = 12;
          const isSearching = search.trim().length > 0;
          const visible = isSearching || showAll ? sorted : sorted.slice(0, PREVIEW);
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
                {visible.map(s => {
                  const isPinned = pinnedSlugs.includes(s.slug);
                  return (
                    <div key={s.slug} style={{ background: s.slug === detected?.slug ? "#0f2040" : "#080f1e", border: `1px solid ${isPinned ? "#fbbf2440" : s.slug === detected?.slug ? "#3b82f6" : "#1e3a5f"}`, borderRadius: "9px", padding: "0.65rem 0.85rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <Link href={`/state/${s.slug}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0, textDecoration: "none" }}>
                        <div style={{ flexShrink: 0, width: "34px", height: "34px", borderRadius: "50%", border: `2px solid ${scoreColor(s.healthScore)}`, display: "flex", alignItems: "center", justifyContent: "center", background: "#060e1c" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: scoreColor(s.healthScore) }}>{s.healthScore}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.82rem", color: s.slug === detected?.slug ? "#93c5fd" : "#e2e8f0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                          <div style={{ fontSize: "0.63rem", color: "#475569", marginTop: "0.1rem" }}>Rank #{s.rank} · 🛡️ {(s.ayushCount ?? 0).toLocaleString("en-IN")} hospitals</div>
                        </div>
                      </Link>
                      <button onClick={() => togglePin(s.slug)} title={isPinned ? "Remove from My States" : "Add to My States Dashboard"}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: isPinned ? "#fbbf24" : "#334155", padding: "0.15rem", flexShrink: 0 }}>
                        {isPinned ? "📌" : "⊕"}
                      </button>
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#475569", fontSize: "0.85rem", padding: "1.5rem" }}>
                    No states match &quot;{search}&quot;
                  </div>
                )}
              </div>
              {!isSearching && sorted.length > PREVIEW && (
                <button onClick={() => setShowAll(v => !v)} style={{ display: "block", width: "100%", marginTop: "0.75rem", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", color: "#60a5fa", fontSize: "0.82rem", fontWeight: 600, padding: "0.55rem", cursor: "pointer", fontFamily: "inherit" }}>
                  {showAll ? "▲ Show fewer states" : `▼ View all ${sorted.length} States & Union Territories`}
                </button>
              )}
            </>
          );
        })()}
        <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#475569", lineHeight: 1.5 }}>
          Health score: weighted composite of IMR, vaccination, institutional births, stunting &amp; anaemia · Source: NFHS-5, SRS 2023, NHA AB-PMJAY
        </div>
      </div>
    </div>
  );
}
