"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import statesRaw from "@/data/states.json";
import citiesRaw from "@/data/cities.json";
import { fetchPHI } from "@/lib/phiCache";

type StateEntry = typeof statesRaw[number];
type CityEntry  = typeof citiesRaw[number];
type SearchItem = { kind: "state"; data: StateEntry } | { kind: "city"; data: CityEntry };

interface IDSPOutbreak {
  uid: string; state: string; district: string; disease: string;
  cases: number; deaths: number; startDate: string; status: string;
  week: number; year: number;
}
interface PHIItem {
  id: string; type: string; title: string;
  disease?: string; location: { state?: string; district?: string };
  summary?: string; cases?: string; deaths?: string;
  date?: string; source: string; status: string; sourceUrl?: string;
}

/* ── Scoring ────────────────────────────────────────────────────────────── */
function healthScore(s: StateEntry): number {
  const imrS   = s.imr                    != null ? Math.max(0, 100 - (s.imr / 55) * 100)             : 50;
  const vaccS  = s.vaccinationPct         != null ? s.vaccinationPct                                   : 50;
  const ibS    = s.institutionalBirthsPct != null ? s.institutionalBirthsPct                           : 50;
  const stuntS = s.stuntingPct            != null ? Math.max(0, 100 - (s.stuntingPct / 50) * 100)     : 50;
  const anaemS = s.womenAnaemiaPct        != null ? Math.max(0, 100 - (s.womenAnaemiaPct / 75) * 100) : 50;
  return Math.round(imrS * 0.30 + vaccS * 0.25 + ibS * 0.20 + stuntS * 0.15 + anaemS * 0.10);
}
function scoreColor(v: number) {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}
function aqiColor(aqi: number) {
  if (aqi <= 50) return "#22c55e";
  if (aqi <= 100) return "#eab308";
  if (aqi <= 150) return "#f97316";
  return "#ef4444";
}

/* ── Search index ───────────────────────────────────────────────────────── */
const INDEX: SearchItem[] = [
  ...statesRaw.map(s => ({ kind: "state" as const, data: s })),
  ...citiesRaw.map(c => ({ kind: "city"  as const, data: c })),
];

function runSearch(q: string): SearchItem[] {
  const lq = q.toLowerCase().trim();
  if (lq.length < 2) return [];
  const scored = INDEX.map(item => {
    const name = item.data.name.toLowerCase();
    const st   = item.kind === "city" ? item.data.stateName.toLowerCase() : "";
    let sc = 0;
    if (name === lq)              sc = 100;
    else if (name.startsWith(lq)) sc = 80;
    else if (name.includes(lq))   sc = 60;
    else if (st.startsWith(lq))   sc = 40;
    else if (st.includes(lq))     sc = 20;
    return { item, sc };
  }).filter(x => x.sc > 0)
    .sort((a, b) => b.sc - a.sc || (a.item.kind === b.item.kind ? 0 : a.item.kind === "state" ? -1 : 1));

  const states = scored.filter(x => x.item.kind === "state").slice(0, 3).map(x => x.item);
  const cities = scored.filter(x => x.item.kind === "city").slice(0, 5).map(x => x.item);
  return [...states, ...cities];
}

function stateMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const na = norm(a), nb = norm(b);
  return na.includes(nb.slice(0, 8)) || nb.includes(na.slice(0, 8));
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function HomeSearch() {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<SearchItem[]>([]);
  const [selected,  setSelected]  = useState<SearchItem | null>(null);
  const [focused,   setFocused]   = useState(false);
  const [idsp,      setIdsp]      = useState<IDSPOutbreak[] | null>(null);
  const [phi,       setPhi]       = useState<PHIItem[] | null>(null);
  const [loadIdsp,  setLoadIdsp]  = useState(false);
  const [loadPhi,   setLoadPhi]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function handleQuery(v: string) {
    setQuery(v);
    setResults(runSearch(v));
    if (selected) { setSelected(null); setIdsp(null); setPhi(null); }
  }

  function pick(item: SearchItem) {
    setSelected(item);
    setQuery(item.data.name);
    setResults([]);
    setIdsp(null); setPhi(null);

    const stateName = item.kind === "state" ? item.data.name : item.data.stateName;

    setLoadIdsp(true);
    fetch("/api/idsp-weekly")
      .then(r => r.json())
      .then(d => {
        const all: IDSPOutbreak[] = d.outbreaks ?? [];
        const filtered = all.filter(o => stateMatches(o.state, stateName));
        const final = item.kind === "city"
          ? filtered.filter(o =>
              o.district.toLowerCase().includes(item.data.name.toLowerCase().slice(0, 5)) ||
              filtered.length <= 6
            )
          : filtered;
        setIdsp(final.slice(0, 6));
      })
      .catch(() => setIdsp([]))
      .finally(() => setLoadIdsp(false));

    setLoadPhi(true);
    fetchPHI()
      .then(d => {
        const all = (d.items ?? []) as PHIItem[];
        const filtered = all
          .filter(p => p.status === "live" && stateMatches(p.location?.state ?? "", stateName))
          .slice(0, 4);
        setPhi(filtered);
      })
      .catch(() => setPhi([]))
      .finally(() => setLoadPhi(false));
  }

  function clear() {
    setQuery(""); setResults([]); setSelected(null); setIdsp(null); setPhi(null);
  }

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setResults([]); setFocused(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") clear(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const profileHref = selected
    ? selected.kind === "state" ? `/state/${selected.data.slug}` : `/district/${selected.data.slug}`
    : "#";

  const dropOpen = results.length > 0 && !selected;
  const panelOpen = !!selected;

  return (
    <div ref={wrapRef} style={{ width: "100%", marginTop: "1.1rem" }}>
      {/* ── Search bar ── */}
      <div style={{ position: "relative" }}>
        <div style={{
          display: "flex", alignItems: "center",
          backgroundColor: "#080f1e",
          border: `1px solid ${focused ? "#0d9488" : "#1e3a5f"}`,
          borderRadius: dropOpen ? "10px 10px 0 0" : panelOpen ? "10px 10px 0 0" : "10px",
          transition: "border-color 0.15s",
        }}>
          <span style={{ padding: "0 0.8rem", fontSize: "1rem", color: "#475569", flexShrink: 0 }}>🔍</span>
          <input
            value={query}
            onChange={e => handleQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search any state or district — news, stats, outbreaks…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              padding: "0.72rem 0.25rem", color: "#e2e8f0", fontSize: "0.88rem",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button onClick={clear} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: "0 0.85rem", fontSize: "1.2rem", lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* ── Dropdown ── */}
        {dropOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
            backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderTop: "none",
            borderRadius: "0 0 10px 10px", boxShadow: "0 12px 40px #00000070",
          }}>
            {results.some(r => r.kind === "state") && (
              <>
                <GroupLabel>States & Union Territories</GroupLabel>
                {results.filter(r => r.kind === "state").map(item => (
                  <DropRow key={item.data.slug} icon="🗺️" badge="State" badgeColor="#0d9488"
                    primary={item.data.name} onClick={() => pick(item)} />
                ))}
              </>
            )}
            {results.some(r => r.kind === "city") && (
              <>
                <GroupLabel borderTop={results.some(r => r.kind === "state")}>Districts & Cities</GroupLabel>
                {results.filter(r => r.kind === "city").map(item => (
                  <DropRow key={item.data.slug} icon="🏙️" badge="District" badgeColor="#6366f1"
                    primary={item.data.name} secondary={(item.data as CityEntry).stateName} onClick={() => pick(item)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Result panel ── */}
      {panelOpen && selected && (
        <div style={{
          backgroundColor: "#080f1e", border: "1px solid #0d948850",
          borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{ backgroundColor: "#071628", borderBottom: "1px solid #1e3a5f", padding: "0.8rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.1rem" }}>{selected.kind === "state" ? "🗺️" : "🏙️"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: "1rem" }}>{selected.data.name}</div>
              {selected.kind === "city" && (
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>{(selected.data as CityEntry).stateName}</div>
              )}
            </div>
            {selected.kind === "state" && (() => {
              const sc = healthScore(selected.data as StateEntry);
              return (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.58rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Health Score</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: scoreColor(sc), fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{sc}</div>
                </div>
              );
            })()}
            <Link href={profileHref}
              style={{ backgroundColor: "#0d9488", color: "#fff", textDecoration: "none", borderRadius: "7px", padding: "0.4rem 1rem", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
              Full Profile →
            </Link>
            <button onClick={clear} style={{ background: "none", border: "1px solid #1e3a5f", borderRadius: "6px", color: "#475569", cursor: "pointer", padding: "0.3rem 0.55rem", fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          <div style={{ padding: "0.85rem 1rem 1rem" }}>

            {/* State stats grid */}
            {selected.kind === "state" && (() => {
              const s = selected.data as StateEntry;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                  {[
                    { label: "IMR (SRS 2023)",        value: s.imr                    != null ? `${s.imr}/1k`                   : "—", color: "#f97316" },
                    { label: "Vaccination",            value: s.vaccinationPct         != null ? `${s.vaccinationPct}%`           : "—", color: "#22c55e" },
                    { label: "Institutional Births",   value: s.institutionalBirthsPct != null ? `${s.institutionalBirthsPct}%`   : "—", color: "#2dd4bf" },
                    { label: "Child Stunting",         value: s.stuntingPct            != null ? `${s.stuntingPct}%`              : "—", color: "#eab308" },
                    { label: "Women Anaemia",          value: s.womenAnaemiaPct        != null ? `${s.womenAnaemiaPct}%`          : "—", color: "#f87171" },
                    { label: "Birth Rate",             value: s.birthRate2023          != null ? `${s.birthRate2023}/1k`          : "—", color: "#818cf8" },
                  ].map(m => (
                    <div key={m.label} style={{ backgroundColor: "#0f2040", borderRadius: "8px", padding: "0.55rem 0.7rem" }}>
                      <div style={{ fontSize: "0.57rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{m.label}</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: m.color, fontFamily: "'IBM Plex Mono', monospace" }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* District/City stats */}
            {selected.kind === "city" && (() => {
              const c = selected.data as CityEntry;
              return (
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                  <Stat label="AQI" value={String(c.aqi ?? "—")} color={aqiColor(c.aqi ?? 0)} sub={c.aqiLabel} />
                  <Stat label="Monitoring Stations" value={String(c.stations ?? "—")} color="#2dd4bf" />
                  <div style={{ backgroundColor: "#0f2040", borderRadius: "8px", padding: "0.55rem 0.75rem", flex: "2 1 180px" }}>
                    <div style={{ fontSize: "0.57rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>State</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0" }}>{c.stateName}</div>
                    <Link href={`/state/${c.stateSlug}`} style={{ fontSize: "0.65rem", color: "#0d9488", textDecoration: "none" }}>View state profile →</Link>
                  </div>
                </div>
              );
            })()}

            {/* IDSP Outbreaks */}
            <AsyncSection title="🦠 IDSP Active Outbreaks" loading={loadIdsp}
              empty={idsp !== null && idsp.length === 0} emptyMsg="No active IDSP outbreaks on record for this location">
              {idsp && idsp.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {idsp.map(o => (
                    <div key={o.uid} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.65rem", backgroundColor: "#0f2040", borderRadius: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0", flex: "1 1 120px" }}>{o.disease}</span>
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>{o.district}</span>
                      <span style={{ fontSize: "0.68rem", color: "#fb923c", fontFamily: "monospace" }}>{o.cases} cases</span>
                      {o.deaths > 0 && <span style={{ fontSize: "0.68rem", color: "#f87171", fontFamily: "monospace" }}>{o.deaths} deaths</span>}
                      <span style={{ fontSize: "0.6rem", color: "#334155", fontFamily: "monospace" }}>W{o.week}/{o.year}</span>
                    </div>
                  ))}
                </div>
              )}
            </AsyncSection>

            {/* PHI News */}
            <AsyncSection title="📰 Public Health News & Alerts" loading={loadPhi}
              empty={phi !== null && phi.length === 0} emptyMsg="No recent PHI alerts for this location">
              {phi && phi.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {phi.map(p => (
                    <div key={p.id} style={{ padding: "0.5rem 0.65rem", backgroundColor: "#0f2040", borderRadius: "6px" }}>
                      <div style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
                        <span style={{
                          fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "3px", flexShrink: 0, marginTop: "0.1rem",
                          backgroundColor: p.type === "Outbreak" ? "#ef444418" : "#0d948818",
                          color: p.type === "Outbreak" ? "#ef4444" : "#0d9488",
                          border: `1px solid ${p.type === "Outbreak" ? "#ef444435" : "#0d948835"}`,
                        }}>{p.type}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {p.sourceUrl
                            ? <a href={p.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 500, textDecoration: "none", lineHeight: 1.4, display: "block" }}>{p.title}</a>
                            : <div style={{ fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 500, lineHeight: 1.4 }}>{p.title}</div>
                          }
                          <div style={{ fontSize: "0.63rem", color: "#475569", marginTop: "0.15rem" }}>
                            {p.source}{p.date ? ` · ${p.date}` : ""}
                            {p.cases && <span style={{ color: "#fb923c", marginLeft: "0.5rem" }}>{p.cases} cases</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AsyncSection>

          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small reusables ─────────────────────────────────────────────────────── */
function GroupLabel({ children, borderTop }: { children: React.ReactNode; borderTop?: boolean }) {
  return (
    <div style={{
      padding: "0.4rem 0.85rem 0.2rem", fontSize: "0.58rem", fontWeight: 700,
      color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em",
      borderTop: borderTop ? "1px solid #0f2040" : "none",
    }}>{children}</div>
  );
}

function DropRow({ icon, primary, secondary, badge, badgeColor, onClick }: {
  icon: string; primary: string; secondary?: string;
  badge: string; badgeColor: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", background: hov ? "#0f2040" : "none", border: "none", cursor: "pointer",
        padding: "0.55rem 0.85rem", display: "flex", alignItems: "center", gap: "0.65rem",
        textAlign: "left", fontFamily: "inherit", transition: "background 0.1s",
      }}>
      <span style={{ fontSize: "0.9rem" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e2e8f0", fontSize: "0.88rem", fontWeight: 500 }}>{primary}</div>
        {secondary && <div style={{ color: "#475569", fontSize: "0.66rem" }}>{secondary}</div>}
      </div>
      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: badgeColor, backgroundColor: `${badgeColor}15`, border: `1px solid ${badgeColor}30`, borderRadius: "4px", padding: "0.1rem 0.4rem", flexShrink: 0 }}>{badge}</span>
    </button>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ backgroundColor: "#0f2040", borderRadius: "8px", padding: "0.55rem 0.75rem", flex: "1 1 90px" }}>
      <div style={{ fontSize: "0.57rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "1.2rem", fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.62rem", color: "#475569" }}>{sub}</div>}
    </div>
  );
}

function AsyncSection({ title, loading, empty, emptyMsg, children }: {
  title: string; loading: boolean; empty: boolean; emptyMsg: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>{title}</div>
      {loading && <div style={{ fontSize: "0.75rem", color: "#334155", padding: "0.3rem 0" }}>Loading…</div>}
      {!loading && empty && <div style={{ fontSize: "0.75rem", color: "#334155", fontStyle: "italic" }}>{emptyMsg}</div>}
      {!loading && !empty && children}
    </div>
  );
}
