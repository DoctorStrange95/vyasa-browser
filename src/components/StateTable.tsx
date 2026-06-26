"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import cities from "@/data/cities.json";

interface State {
  slug: string;
  name: string;
  imr: number | null;
  neonatalMR: number | null;
  under5MR: number | null;
  vaccinationPct: number | null;
  stuntingPct: number | null;
  underweightPct: number | null;
  wastingPct: number | null;
  institutionalBirthsPct: number | null;
  anaemiaPct: number | null;
  womenAnaemiaPct: number | null;
}

const COLS = [
  { key: "imr",           label: "IMR",      tip: "Infant Mortality Rate / 1000 live births (lower is better)" },
  { key: "vaccinationPct",label: "Vacc %",   tip: "Children fully immunized age 12–23 months (higher is better)" },
  { key: "stuntingPct",   label: "Stunt %",  tip: "Children with height-for-age < -2SD (lower is better)" },
  { key: "under5MR",      label: "U5-MR",    tip: "Under-5 Mortality Rate / 1000 live births (lower is better)" },
  { key: "instBirths",    label: "Inst. Births", tip: "Deliveries in health facility (higher is better)" },
];

function chip(v: number | null, best: number, worst: number, higher: boolean) {
  if (v === null) return { color: "#475569", bg: "#1e3a5f30", label: "—" };
  const good = higher ? v >= best : v <= best;
  const bad  = higher ? v <= worst : v >= worst;
  const color = good ? "#22c55e" : bad ? "#ef4444" : "#eab308";
  const bg    = good ? "#22c55e15" : bad ? "#ef444415" : "#eab30815";
  return { color, bg, label: String(v) };
}

function cityCount(stateSlug: string) {
  return cities.filter((c) => c.stateSlug === stateSlug).length;
}

function stateCities(stateSlug: string) {
  return cities.filter((c) => c.stateSlug === stateSlug).slice(0, 5);
}

export default function StateTable({ states }: { states: State[] }) {
  const [query, setQuery]     = useState("");
  const [sortKey, setSortKey] = useState<string>("imr");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll]   = useState(false);

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = useMemo(() => {
    const filtered = states.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase())
    );
    const getValue = (s: State): number => {
      if (sortKey === "imr")            return s.imr ?? 999;
      if (sortKey === "vaccinationPct") return s.vaccinationPct ?? 0;
      if (sortKey === "stuntingPct")    return s.stuntingPct ?? 999;
      if (sortKey === "under5MR")       return s.under5MR ?? 999;
      if (sortKey === "instBirths")     return s.institutionalBirthsPct ?? 0;
      return 0;
    };
    const higherBetter = sortKey === "vaccinationPct" || sortKey === "instBirths";
    return [...filtered].sort((a, b) => {
      const diff = getValue(a) - getValue(b);
      const dir  = higherBetter ? -diff : diff;
      return sortAsc ? dir : -dir;
    });
  }, [states, query, sortKey, sortAsc]);

  return (
    <section id="states" style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
      {/* Section header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.9rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
          States &amp; Union Territories
        </h2>
        <p style={{ fontSize: "0.88rem", color: "#64748b" }}>
          {sorted.length} of {states.length} · NFHS-6 (2023-24) · Click any row to explore districts, AQI &amp; health centres
        </p>
      </div>

      {/* Search + legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: "320px" }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: "0.85rem" }}>⌕</span>
          <input
            type="text"
            placeholder="Search state or UT…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%", backgroundColor: "#0f2040", border: "1px solid #1e3a5f",
              borderRadius: "8px", padding: "0.55rem 0.9rem 0.55rem 2rem",
              color: "#e2e8f0", fontSize: "0.85rem", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {[["#22c55e", "Good"], ["#eab308", "Average"], ["#ef4444", "Needs Attention"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "#64748b" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: c, display: "inline-block" }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #1e3a5f", borderRadius: "12px", overflow: "hidden" }}>
        {/* Column headers */}
        <div className="state-table-header" style={{
          backgroundColor: "#060e1c",
          borderBottom: "1px solid #1e3a5f",
          padding: "0 0",
        }}>
          <div style={{ padding: "0.75rem 1.25rem", fontSize: "0.7rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            State / UT
          </div>
          {COLS.map((col) => (
            <button
              key={col.key}
              onClick={() => toggleSort(col.key)}
              title={col.tip}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "0.75rem 0.5rem", fontSize: "0.7rem", textTransform: "uppercase",
                letterSpacing: "0.08em", color: sortKey === col.key ? "#2dd4bf" : "#475569",
                textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem",
              }}
            >
              {col.label}
              <span style={{ fontSize: "0.6rem" }}>{sortKey === col.key ? (sortAsc ? "↑" : "↓") : "↕"}</span>
            </button>
          ))}
          <div style={{ padding: "0.75rem 0.5rem", fontSize: "0.7rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>
            Cities
          </div>
          <div />
        </div>

        {/* Rows */}
        {sorted.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#475569" }}>No states match &quot;{query}&quot;</div>
        ) : (
          (query || showAll ? sorted : sorted.slice(0, 5)).map((s, idx) => (
            <StateRow
              key={s.slug}
              state={s}
              rank={idx + 1}
              isExpanded={expanded === s.slug}
              onToggle={() => setExpanded(expanded === s.slug ? null : s.slug)}
              cityCount={cityCount(s.slug)}
              topCities={stateCities(s.slug)}
            />
          ))
        )}
      </div>

      {/* Show more / less — only when not actively searching */}
      {!query && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={() => setShowAll(p => !p)}
            style={{
              backgroundColor: "#0d948815", border: "1px solid #0d948840",
              color: "#2dd4bf", borderRadius: "8px", padding: "0.55rem 2rem",
              fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showAll ? `▲ Show less` : `▼ Show all ${sorted.length} States & UTs`}
          </button>
        </div>
      )}

      <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#334155", textAlign: "right" }}>
        Source: NFHS-6 (2023-24) · IMR/U5-MR per 1000 live births · Hover column headers for definitions
      </p>
    </section>
  );
}

function Chip({ value, best, worst, higher, unit = "" }: { value: number | null; best: number; worst: number; higher: boolean; unit?: string }) {
  const { color, bg, label } = chip(value, best, worst, higher);
  if (label === "—") return <span style={{ color: "#334155", fontSize: "0.78rem" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      backgroundColor: bg, borderRadius: "5px", padding: "0.2rem 0.5rem",
      fontSize: "0.78rem", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: color, flexShrink: 0, display: "inline-block" }} />
      <span style={{ color }}>{label}{unit}</span>
    </span>
  );
}

function StateRow({ state, rank, isExpanded, onToggle, cityCount: count, topCities }: {
  state: State;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  cityCount: number;
  topCities: typeof cities;
}) {
  return (
    <div style={{ borderBottom: "1px solid #1e3a5f" }}>
      {/* Main row */}
      <div
        className="state-table-row state-row-wrap"
        onClick={onToggle}
        style={{
          alignItems: "center",
          padding: "0",
          cursor: "pointer",
          backgroundColor: isExpanded ? "#0f2040" : "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "#0d142580"; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {/* State name */}
        <div className="state-row-name" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.65rem", color: "#334155", fontFamily: "'IBM Plex Mono', monospace", minWidth: "18px" }}>{rank}</span>
          <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.92rem" }}>{state.name}</span>
        </div>

        {/* Metric chips — desktop: individual cells; mobile: inline labeled row */}
        <div className="desktop-chips" style={{ display: "contents" }}>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <Chip value={state.imr} best={20} worst={40} higher={false} />
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <Chip value={state.vaccinationPct} best={85} worst={60} higher unit="%" />
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <Chip value={state.stuntingPct} best={20} worst={40} higher={false} unit="%" />
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <Chip value={state.under5MR} best={25} worst={50} higher={false} />
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <Chip value={state.institutionalBirthsPct} best={90} worst={70} higher unit="%" />
          </div>
        </div>

        {/* City count */}
        <div className="state-row-cities" style={{ textAlign: "center", padding: "0.5rem" }}>
          <span style={{ fontSize: "0.82rem", color: count > 0 ? "#2dd4bf" : "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>
            {count > 0 ? count : "—"}
          </span>
        </div>

        {/* Expand toggle */}
        <div className="state-row-toggle" style={{ textAlign: "center", padding: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#2dd4bf", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        </div>
      </div>

      {/* Mobile-only chips row */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-chips { display: flex !important; flex-wrap: wrap; gap: 0.4rem; padding: 0 1rem 0.75rem; }
          .desktop-chips > div { padding: 0 !important; text-align: left !important; }
        }
      `}</style>

      {/* Expanded accordion */}
      {isExpanded && (
        <div style={{ backgroundColor: "#070f1e", borderTop: "1px solid #1e3a5f", padding: "1.25rem 1.5rem 1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", marginBottom: "1.25rem" }}>
            {/* Extra metrics */}
            <div>
              <div style={{ fontSize: "0.7rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Additional Health Indicators</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                {state.neonatalMR !== null && (
                  <MetaChip label="Neonatal MR" value={`${state.neonatalMR}/1000 LB`} color={state.neonatalMR <= 15 ? "#22c55e" : state.neonatalMR >= 30 ? "#ef4444" : "#eab308"} />
                )}
                {state.underweightPct !== null && (
                  <MetaChip label="Underweight" value={`${state.underweightPct}%`} color={state.underweightPct <= 20 ? "#22c55e" : state.underweightPct >= 40 ? "#ef4444" : "#eab308"} />
                )}
                {state.wastingPct !== null && (
                  <MetaChip label="Wasting" value={`${state.wastingPct}%`} color={state.wastingPct <= 10 ? "#22c55e" : state.wastingPct >= 20 ? "#ef4444" : "#eab308"} />
                )}
                {state.anaemiaPct !== null && (
                  <MetaChip label="Child Anaemia" value={`${state.anaemiaPct}%`} color={state.anaemiaPct <= 40 ? "#22c55e" : state.anaemiaPct >= 70 ? "#ef4444" : "#eab308"} />
                )}
                {state.womenAnaemiaPct !== null && (
                  <MetaChip label="Women Anaemia" value={`${state.womenAnaemiaPct}%`} color={state.womenAnaemiaPct <= 30 ? "#22c55e" : state.womenAnaemiaPct >= 55 ? "#ef4444" : "#eab308"} />
                )}
              </div>
            </div>

            {/* Cities */}
            {topCities.length > 0 && (
              <div>
                <div style={{ fontSize: "0.7rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                  CPCB Monitored Cities
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {topCities.map((c) => (
                    <Link key={c.slug} href={`/district/${c.slug}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.35rem",
                        backgroundColor: "#0f2040", border: "1px solid #1e3a5f",
                        borderRadius: "6px", padding: "0.3rem 0.65rem", fontSize: "0.78rem", color: "#94a3b8",
                        cursor: "pointer",
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: aqiChipColor(c.aqiLabel), display: "inline-block", flexShrink: 0 }} />
                        {c.name}
                        <span style={{ fontSize: "0.68rem", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{c.aqi}</span>
                      </span>
                    </Link>
                  ))}
                  {topCities.length < cityCount(state.slug) && (
                    <span style={{ fontSize: "0.75rem", color: "#475569", alignSelf: "center" }}>
                      +{cityCount(state.slug) - topCities.length} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/state/${state.slug}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              backgroundColor: "#0d9488", color: "#fff", textDecoration: "none",
              padding: "0.55rem 1.25rem", borderRadius: "7px", fontSize: "0.85rem", fontWeight: 600,
            }}
          >
            View Full State Dashboard →
          </Link>
          <Link
            href={`/state/${state.slug}#facilities`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              backgroundColor: "transparent", color: "#2dd4bf", textDecoration: "none",
              padding: "0.55rem 1.25rem", borderRadius: "7px", fontSize: "0.85rem", fontWeight: 500,
              border: "1px solid #1e3a5f", marginLeft: "0.75rem",
            }}
          >
            Find Nearby PHC / CHC
          </Link>
        </div>
      )}
    </div>
  );
}

function MetaChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "0.4rem 0.7rem" }}>
      <div style={{ fontSize: "0.62rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.1rem" }}>{label}</div>
      <div className="font-data" style={{ fontSize: "0.85rem", fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function aqiChipColor(label: string) {
  if (label === "Good") return "#22c55e";
  if (label === "Moderate") return "#eab308";
  if (label.includes("Sensitive")) return "#f97316";
  if (label === "Unhealthy") return "#ef4444";
  return "#a855f7";
}
