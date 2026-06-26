"use client";
import { useState } from "react";
import Link from "next/link";
import IndiaMap from "./IndiaMap";
import FacilityFinder from "./FacilityFinder";

interface StateData {
  slug: string;
  name: string;
  imr: number | null;
  vaccinationPct: number | null;
  stuntingPct: number | null;
  under5MR: number | null;
  institutionalBirthsPct: number | null;
  neonatalMR: number | null;
  underweightPct: number | null;
  anaemiaPct: number | null;
  womenAnaemiaPct: number | null;
}

type PanelTab = "score" | "facilities";

/* ── Health Score ──────────────────────────────────────── */
function healthScore(s: StateData): number {
  const imrS   = s.imr                    !== null ? Math.max(0, 100 - (s.imr / 55) * 100)          : 50;
  const vaccS  = s.vaccinationPct         !== null ? s.vaccinationPct                                : 50;
  const ibS    = s.institutionalBirthsPct !== null ? s.institutionalBirthsPct                        : 50;
  const stuntS = s.stuntingPct            !== null ? Math.max(0, 100 - (s.stuntingPct / 50) * 100)  : 50;
  const anaemS = s.womenAnaemiaPct        !== null ? Math.max(0, 100 - (s.womenAnaemiaPct / 75) * 100) : 50;
  return Math.round(imrS * 0.30 + vaccS * 0.25 + ibS * 0.20 + stuntS * 0.15 + anaemS * 0.10);
}

function scoreColor(v: number) {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

function imrBand(v: number | null) {
  if (v === null) return { color: "#94a3b8", label: "—" };
  if (v <= 15) return { color: "#22c55e", label: "Good" };
  if (v <= 25) return { color: "#84cc16", label: "Moderate" };
  if (v <= 35) return { color: "#eab308", label: "Average" };
  return        { color: "#ef4444",  label: "Needs Attention" };
}

/* ── Metric Bar ─────────────────────────────────────────── */
function MetricBar({
  label, value, unit, score, nationalVal, nationalLabel, higherIsBetter,
}: {
  label: string; value: number | null; unit: string; score: number;
  nationalVal: string; nationalLabel: string; higherIsBetter: boolean;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const color = scoreColor(score);
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#64748b" }}>{label}</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.6rem", color: "#334155" }}>nat. {nationalVal}</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color, fontFamily: "monospace" }}>
            {value !== null ? `${value}${unit}` : "—"}
          </span>
        </div>
      </div>
      <div style={{ height: "5px", backgroundColor: "#0a1628", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

/* ── Mini score bar for list ────────────────────────────── */
function MiniScoreBar({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: "70px" }}>
      <div style={{ flex: 1, height: "4px", backgroundColor: "#0a1628", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, backgroundColor: color, borderRadius: "2px" }} />
      </div>
      <span style={{ fontSize: "0.65rem", color, fontFamily: "monospace", minWidth: "22px", textAlign: "right" }}>{score}</span>
    </div>
  );
}

const NATIONAL = [
  { v: "25",    l: "Nat. IMR",    s: "SRS 2023",  c: "#f87171" },
  { v: "82.6%", l: "Vacc.",       s: "NFHS-6",    c: "#4ade80" },
  { v: "29.3%", l: "Stunting",    s: "NFHS-6",    c: "#fb923c" },
  { v: "90.6%", l: "Inst. Birth", s: "NFHS-6",    c: "#818cf8" },
  { v: "32",    l: "U5-MR",       s: "SRS 2023",  c: "#fbbf24" },
  { v: "67.1%", l: "Anaemia",     s: "NFHS-5",    c: "#f472b6" },
];

export default function InteractiveHome({ states }: { states: StateData[] }) {
  const [tab,          setTab]          = useState<PanelTab>("score");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [stateListOpen, setStateListOpen] = useState(false);

  const selected = selectedSlug ? states.find(s => s.slug === selectedSlug) ?? null : null;
  const sorted   = [...states].sort((a, b) => healthScore(b) - healthScore(a));
  const preview  = stateListOpen ? sorted : sorted.slice(0, 5);

  function handleSelect(slug: string) {
    setSelectedSlug(p => p === slug ? null : slug);
    setTab("score");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", height: "calc(100vh - 58px)", overflow: "hidden" }}>

      {/* ── LEFT: Map ──────────────────────────────────────────── */}
      <div style={{ padding: "0.85rem 0.85rem 0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.6rem", borderRight: "1px solid #1e3a5f", overflow: "hidden" }}>

        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#2dd4bf", boxShadow: "0 0 6px #2dd4bf", display: "inline-block" }} />
            <h1 className="font-display" style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0 }}>India Health Map</h1>
          </div>
          <span style={{ fontSize: "0.58rem", color: "#334155", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "0.1rem 0.4rem", fontFamily: "monospace" }}>NFHS-6 · SRS 2023</span>
          <span style={{ fontSize: "0.65rem", color: "#475569", marginLeft: "auto" }}>Hover to preview · Click to select</span>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <IndiaMap states={states} onSelect={handleSelect} selectedSlug={selectedSlug} />
        </div>

        <div style={{ flexShrink: 0, display: "flex", gap: "0.45rem", overflowX: "auto", paddingBottom: "2px" }}>
          {NATIONAL.map(s => (
            <div key={s.l} style={{ flexShrink: 0, backgroundColor: "#060d1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.4rem 0.65rem", textAlign: "center", minWidth: "82px" }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: s.c, fontFamily: "monospace" }}>{s.v}</div>
              <div style={{ fontSize: "0.58rem", color: "#64748b" }}>{s.l}</div>
              <div style={{ fontSize: "0.52rem", color: "#334155" }}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Panel ───────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#06111f" }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
          {([
            { id: "score",      icon: "📈", label: "Health Index"  },
            { id: "facilities", icon: "🏥", label: "Find Nearby"   },
          ] as { id: PanelTab; icon: string; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "0.65rem 0.4rem",
              fontSize: "0.72rem", fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? "#0a1628" : "transparent",
              color: tab === t.id ? "#e2e8f0" : "#475569",
              border: "none", borderBottom: tab === t.id ? "2px solid #2dd4bf" : "2px solid transparent",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.8rem" }}>

          {/* ── Health Index tab ── */}
          {tab === "score" && (
            <>
              {selected ? (
                /* ── Selected state: score card + metric bars ── */
                <>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{selected.name}</h2>
                      {(() => { const b = imrBand(selected.imr); return (
                        <span style={{ fontSize: "0.62rem", color: b.color, backgroundColor: b.color+"20", borderRadius: "4px", padding: "0.1rem 0.5rem", fontWeight: 600 }}>● {b.label}</span>
                      );})()}
                    </div>
                    <button onClick={() => setSelectedSlug(null)} style={{ fontSize: "0.68rem", background: "none", border: "1px solid #1e3a5f", color: "#475569", borderRadius: "5px", padding: "0.28rem 0.45rem", cursor: "pointer" }}>✕</button>
                  </div>

                  {/* Big score ring */}
                  {(() => {
                    const sc = healthScore(selected);
                    const color = scoreColor(sc);
                    const rank = sorted.findIndex(s => s.slug === selected.slug) + 1;
                    const circumference = 2 * Math.PI * 26;
                    const dash = (sc / 100) * circumference;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.8rem 1rem", marginBottom: "0.75rem" }}>
                        <svg width="70" height="70" viewBox="0 0 60 60">
                          <circle cx="30" cy="30" r="26" fill="none" stroke="#0a1628" strokeWidth="5" />
                          <circle cx="30" cy="30" r="26" fill="none" stroke={color} strokeWidth="5"
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeLinecap="round"
                            transform="rotate(-90 30 30)"
                            style={{ transition: "stroke-dasharray 0.6s ease" }}
                          />
                          <text x="30" y="33" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color} fontFamily="monospace">{sc}</text>
                        </svg>
                        <div>
                          <div style={{ fontSize: "0.62rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Health Index</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color, marginBottom: "0.1rem" }}>
                            {sc >= 80 ? "Excellent" : sc >= 65 ? "Good" : sc >= 50 ? "Average" : sc >= 35 ? "Poor" : "Critical"}
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "#475569" }}>Rank #{rank} of {states.length} states</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Metric bars */}
                  <div style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.75rem 0.9rem", marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.58rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>Metric Breakdown vs National</div>

                    <MetricBar
                      label="Infant Mortality Rate" value={selected.imr} unit="/1000 LB"
                      score={selected.imr !== null ? Math.max(0, 100 - (selected.imr / 55) * 100) : 50}
                      nationalVal="25" nationalLabel="SRS 2023" higherIsBetter={false}
                    />
                    <MetricBar
                      label="Vaccination Coverage" value={selected.vaccinationPct} unit="%"
                      score={selected.vaccinationPct ?? 50}
                      nationalVal="82.6%" nationalLabel="NFHS-6" higherIsBetter={true}
                    />
                    <MetricBar
                      label="Institutional Births" value={selected.institutionalBirthsPct} unit="%"
                      score={selected.institutionalBirthsPct ?? 50}
                      nationalVal="90.6%" nationalLabel="NFHS-6" higherIsBetter={true}
                    />
                    <MetricBar
                      label="Child Stunting" value={selected.stuntingPct} unit="%"
                      score={selected.stuntingPct !== null ? Math.max(0, 100 - (selected.stuntingPct / 50) * 100) : 50}
                      nationalVal="29.3%" nationalLabel="NFHS-6" higherIsBetter={false}
                    />
                    <MetricBar
                      label="Women's Anaemia" value={selected.womenAnaemiaPct} unit="%"
                      score={selected.womenAnaemiaPct !== null ? Math.max(0, 100 - (selected.womenAnaemiaPct / 75) * 100) : 50}
                      nationalVal="57%" nationalLabel="NFHS-5" higherIsBetter={false}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
                    <Link href={`/state/${selected.slug}`} style={{ textAlign: "center", fontSize: "0.72rem", backgroundColor: "#0d948815", border: "1px solid #0d948840", color: "#2dd4bf", borderRadius: "7px", padding: "0.5rem", textDecoration: "none", fontWeight: 600 }}>
                      Districts &amp; Cities →
                    </Link>
                    <button onClick={() => setTab("facilities")} style={{ fontSize: "0.72rem", backgroundColor: "#6366f115", border: "1px solid #6366f130", color: "#818cf8", borderRadius: "7px", padding: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      🏥 Find Nearby
                    </button>
                  </div>

                  {/* Quick compare strip */}
                  <div style={{ paddingTop: "0.55rem", borderTop: "1px solid #1e3a5f" }}>
                    <div style={{ fontSize: "0.6rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Top States by Index</div>
                    {sorted.slice(0, 3).map(s => {
                      const sc = healthScore(s);
                      return (
                        <button key={s.slug} onClick={() => handleSelect(s.slug)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: s.slug === selectedSlug ? "#0f2040" : "transparent", border: "none", borderRadius: "5px", padding: "0.3rem 0.4rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "0.15rem", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8", flex: 1, textAlign: "left" }}>{s.name}</span>
                          <MiniScoreBar score={sc} />
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* ── No selection: ranked health index list ── */
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
                    <span style={{ fontSize: "0.65rem", color: "#475569" }}>{states.length} States &amp; UTs · ranked by Health Index</span>
                    <span style={{ fontSize: "0.58rem", color: "#334155" }}>Click to explore</span>
                  </div>

                  {/* Column headers */}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0.4rem 0.3rem", borderBottom: "1px solid #0a1628", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.58rem", color: "#334155" }}>STATE</span>
                    <span style={{ fontSize: "0.58rem", color: "#334155" }}>HEALTH INDEX</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.22rem" }}>
                    {preview.map((s, i) => {
                      const sc = healthScore(s);
                      const color = scoreColor(sc);
                      return (
                        <button key={s.slug} onClick={() => handleSelect(s.slug)} style={{
                          display: "flex", alignItems: "center", gap: "0.5rem",
                          backgroundColor: "#080f1e", border: "1px solid #1e3a5f",
                          borderLeft: `3px solid ${color}`,
                          borderRadius: "7px", padding: "0.42rem 0.65rem",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#0f2040")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#080f1e")}
                        >
                          <span style={{ fontSize: "0.6rem", color: "#334155", minWidth: "14px", fontFamily: "monospace" }}>{i + 1}</span>
                          <span style={{ fontSize: "0.78rem", color: "#e2e8f0", fontWeight: 500, flex: 1, textAlign: "left" }}>{s.name}</span>
                          <MiniScoreBar score={sc} />
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={() => setStateListOpen(p => !p)} style={{
                    width: "100%", marginTop: "0.5rem", padding: "0.4rem",
                    fontSize: "0.72rem", color: "#2dd4bf", fontWeight: 600,
                    backgroundColor: "#0d948810", border: "1px solid #0d948830",
                    borderRadius: "7px", cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {stateListOpen ? `▲ Show less` : `▼ Show all ${states.length} states`}
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Facilities tab ── */}
          {tab === "facilities" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <FacilityFinder />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
