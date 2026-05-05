"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchPHI } from "@/lib/phiCache";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import type { IDSPWeeklyMeta } from "@/app/api/idsp-weekly/route";
import type { IDSPOutbreak } from "@/lib/idspPDFParser";

interface PHIItem {
  type: string;
  title: string;
  disease?: string;
  location: { state?: string; district?: string };
  summary: string;
  source: string;
  sourceUrl?: string;
  date?: string;
}

function matchesPHI(o: IDSPOutbreak, items: PHIItem[]): PHIItem[] {
  const dis = o.disease.toLowerCase();
  const st  = o.state.toLowerCase().slice(0, 5);
  return items.filter(item => {
    const t = (item.title + " " + (item.disease ?? "") + " " + (item.location?.state ?? "")).toLowerCase();
    return t.includes(dis.slice(0, 6)) || (st && t.includes(st));
  }).slice(0, 3);
}
import districts from "@/data/districts.json";
import states from "@/data/states.json";

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const districtSlugMap: Record<string, string> = Object.fromEntries(
  districts.map(d => [toSlug(d.name), d.slug])
);
const stateSlugMap: Record<string, string> = Object.fromEntries(
  states.map(s => [toSlug(s.name.replace(/&/g, "and")), s.slug])
);

function resolveLink(district: string, state: string): string {
  const dSlug = districtSlugMap[toSlug(district)];
  if (dSlug) return `/district/${dSlug}`;
  const sSlug = stateSlugMap[toSlug(state.replace(/&/g, "and"))];
  if (sSlug) return `/state/${sSlug}`;
  return `/state/${toSlug(state)}`;
}

function stateLink(state: string): string {
  const sSlug = stateSlugMap[toSlug(state.replace(/&/g, "and"))];
  return `/state/${sSlug ?? toSlug(state)}`;
}

const DISEASE_COLORS: Record<string, string> = {
  "Chickenpox":               "#a78bfa",
  "Measles":                  "#f87171",
  "Acute Diarrhoeal Disease": "#60a5fa",
  "Acute Diarrheal Disease":  "#60a5fa",
  "Dengue":                   "#fb923c",
  "Malaria":                  "#4ade80",
  "Hepatitis A":              "#fbbf24",
  "Hepatitis B":              "#f59e0b",
  "Chikungunya":              "#e879f9",
  "Typhoid":                  "#34d399",
  "Suspected Typhoid":        "#34d399",
  "Cholera":                  "#38bdf8",
  "Food Poisoning":           "#ff6b6b",
  "Suspected Food Poisoning": "#ff6b6b",
  "Mpox":                     "#f472b6",
  "Scrub Typhus":             "#facc15",
  "Leptospirosis":            "#86efac",
  "Fever":                    "#94a3b8",
  "Acute Gastroenteritis":    "#67e8f9",
  "Acute Encephalitis Syndrome": "#c084fc",
};

function diseaseColor(d: string): string {
  const key = Object.keys(DISEASE_COLORS).find(k => d?.toLowerCase().includes(k.toLowerCase()));
  return key ? DISEASE_COLORS[key] : "#64748b";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function currentISOWeek(): number {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfWeek = jan4.getDay();
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - ((dayOfWeek + 6) % 7));
  return Math.ceil((now.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
}

function weekToDateRange(week: number, year: number): string {
  const w = week > 0 ? week : currentISOWeek();
  const y = week > 0 ? year : new Date().getFullYear();
  const jan4 = new Date(y, 0, 4);
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}, ${y}`;
}

export default function IDSPWeeklyReport() {
  const [data,             setData]             = useState<IDSPWeeklyMeta | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [expanded,         setExpanded]         = useState(false);
  const [phiItems,         setPhiItems]         = useState<PHIItem[]>([]);
  const [openNews,         setOpenNews]         = useState<string | null>(null);
  const [selectedDisease,  setSelectedDisease]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/idsp-weekly")
      .then(r => r.json())
      .then(d => { setData(d as IDSPWeeklyMeta); setLoading(false); })
      .catch(() => setLoading(false));
    // Also load PHI feed for cross-referencing
    fetchPHI()
      .then(d => { if (Array.isArray(d?.items)) setPhiItems(d.items as PHIItem[]); })
      .catch(() => {});
  }, []);

  const outbreaks: IDSPOutbreak[] = data?.outbreaks ?? [];
  const pdfUrl = data?.pdfUrl ?? "https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689";

  // Disease tally — track both outbreak count and total cases
  const diseaseTally: Record<string, { outbreaks: number; cases: number }> = {};
  for (const o of outbreaks) {
    if (!diseaseTally[o.disease]) diseaseTally[o.disease] = { outbreaks: 0, cases: 0 };
    diseaseTally[o.disease].outbreaks++;
    diseaseTally[o.disease].cases += o.cases;
  }
  const sorted = Object.entries(diseaseTally).sort((a, b) => b[1].outbreaks - a[1].outbreaks).slice(0, 10);
  const maxCount = sorted[0]?.[1].outbreaks ?? 1;

  // State tally
  const stateTally: Record<string, { count: number; cases: number; diseases: string[] }> = {};
  for (const o of outbreaks) {
    if (!stateTally[o.state]) stateTally[o.state] = { count: 0, cases: 0, diseases: [] };
    stateTally[o.state].count++;
    stateTally[o.state].cases += o.cases;
    if (o.disease && !stateTally[o.state].diseases.includes(o.disease))
      stateTally[o.state].diseases.push(o.disease);
  }
  const statesSorted = Object.entries(stateTally).sort((a, b) => b[1].count - a[1].count);
  const visibleStates = expanded ? statesSorted : statesSorted.slice(0, 8);

  const totalCases  = outbreaks.reduce((s, o) => s + o.cases, 0);
  const totalDeaths = outbreaks.reduce((s, o) => s + o.deaths, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header card */}
      <div style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0f1e3a 100%)",
        border: "1px solid #1e3a5f", borderTop: "3px solid #ef4444",
        borderRadius: "14px", padding: "1.25rem 1.5rem",
        display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.55rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.15rem" }}>IDSP Week</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#ef4444", lineHeight: 1, fontFamily: "monospace" }}>
              {loading ? "–" : data?.week ? ordinal(data.week) : ordinal(currentISOWeek())}
            </div>
            <div style={{ fontSize: "0.6rem", color: "#475569" }}>{data?.year ?? new Date().getFullYear()}</div>
          </div>

          <div style={{ width: "1px", height: "48px", backgroundColor: "#1e3a5f", flexShrink: 0 }} className="divider-v" />

          <div>
            <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "0.3rem" }}>
              {loading
                ? "⏳ Please wait, loading IDSP outbreak data…"
                : `📅 ${data?.dateRange ?? weekToDateRange(data?.week ?? 0, data?.year ?? new Date().getFullYear())}`
              }
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", backgroundColor: "#ef444420", border: "1px solid #ef444440", color: "#f87171", borderRadius: "5px", padding: "0.2rem 0.6rem", fontWeight: 700 }}>
                🚨 {loading ? "…" : outbreaks.length} Outbreaks
              </span>
              <span style={{ fontSize: "0.72rem", backgroundColor: "#fb923c20", border: "1px solid #fb923c40", color: "#fb923c", borderRadius: "5px", padding: "0.2rem 0.6rem" }}>
                🧑‍⚕️ {loading ? "…" : totalCases.toLocaleString()} Cases
              </span>
              {totalDeaths > 0 && (
                <span style={{ fontSize: "0.72rem", backgroundColor: "#f8717120", border: "1px solid #f8717140", color: "#f87171", borderRadius: "5px", padding: "0.2rem 0.6rem" }}>
                  ☠ {totalDeaths} Deaths
                </span>
              )}
              <span style={{ fontSize: "0.72rem", backgroundColor: "#0d948820", border: "1px solid #0d948840", color: "#2dd4bf", borderRadius: "5px", padding: "0.2rem 0.6rem" }}>
                📍 {loading ? "…" : statesSorted.length} States
              </span>
              <span style={{ fontSize: "0.72rem", backgroundColor: "#6366f120", border: "1px solid #6366f140", color: "#818cf8", borderRadius: "5px", padding: "0.2rem 0.6rem" }}>
                🏛 {data?.reportingStates ?? 18}/36 Reporting
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            style={{
              backgroundColor: "#ef444420", border: "1px solid #ef444450", color: "#f87171",
              borderRadius: "8px", padding: "0.55rem 1.1rem",
              fontSize: "0.8rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
            📥 Official PDF
          </a>
          <a href="https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689"
            target="_blank" rel="noopener noreferrer"
            style={{
              backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8",
              borderRadius: "8px", padding: "0.55rem 1.1rem",
              fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
            }}>
            All Reports ↗
          </a>
        </div>

        {/* Push notification opt-in */}
        <div style={{ maxWidth: "340px" }}>
          <PushNotificationSetup />
        </div>
      </div>

      {/* Two-column: disease chart + state breakdown */}
      {!loading && outbreaks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="idsp-grid">

          {/* Disease frequency chart — clickable */}
          <div style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.85rem", fontWeight: 700 }}>
              Disease Distribution · This Week
              <span style={{ marginLeft: "0.5rem", color: "#334155", fontWeight: 400, textTransform: "none" }}>— click to see affected areas</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {sorted.map(([disease, info]) => {
                const count    = info.outbreaks;
                const cases    = info.cases;
                const color    = diseaseColor(disease);
                const pct      = (count / maxCount) * 100;
                const isOpen   = selectedDisease === disease;
                const affected = outbreaks.filter(o => o.disease === disease);
                return (
                  <div key={disease}>
                    {/* Clickable bar row */}
                    <button
                      onClick={() => setSelectedDisease(isOpen ? null : disease)}
                      style={{ width: "100%", background: isOpen ? "#0f2040" : "transparent", border: "none", borderRadius: "6px", padding: "0.35rem 0.4rem", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.7rem", color: isOpen ? color : "#94a3b8", fontWeight: isOpen ? 700 : 500 }}>{disease}</span>
                        <div className="idsp-disease-row-stats" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.68rem", color, fontWeight: 700, fontFamily: "monospace" }}>{count}</span>
                          <span style={{ fontSize: "0.58rem", color: "#334155" }}>outbreak{count !== 1 ? "s" : ""}</span>
                          <span style={{ fontSize: "0.55rem", color: "#1e3a5f" }}>·</span>
                          <span style={{ fontSize: "0.68rem", color: "#fb923c", fontWeight: 700, fontFamily: "monospace" }}>{cases.toLocaleString()}</span>
                          <span style={{ fontSize: "0.58rem", color: "#334155" }}>cases</span>
                          <span style={{ fontSize: "0.6rem", color: "#475569", marginLeft: "0.1rem" }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      <div style={{ height: "6px", backgroundColor: "#0f2040", borderRadius: "3px" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, borderRadius: "3px",
                          background: `linear-gradient(90deg, ${color}90, ${color})`,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </button>

                    {/* Expanded: state/district breakdown */}
                    {isOpen && (
                      <div style={{ marginTop: "0.35rem", marginBottom: "0.35rem", background: "#060e1c", border: `1px solid ${color}30`, borderRadius: "8px", padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        <div style={{ fontSize: "0.6rem", color: color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.1rem" }}>
                          {count} outbreak{count !== 1 ? "s" : ""} · {affected.reduce((s, o) => s + o.cases, 0).toLocaleString()} cases total
                        </div>
                        {affected.map((o, i) => (
                          <Link
                            key={i}
                            href={resolveLink(o.district, o.state)}
                            style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.3rem 0.5rem", background: "#0a1628", borderRadius: "6px", border: "1px solid #1e3a5f" }}
                          >
                            <div>
                              <span style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600 }}>
                                {o.district ? `${o.district}, ` : ""}{o.state}
                              </span>
                              {o.startDate && (
                                <span style={{ fontSize: "0.6rem", color: "#334155", marginLeft: "0.4rem" }}>since {o.startDate}</span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.68rem", color: "#fb923c" }}>{o.cases} cases</span>
                              {o.deaths > 0 && <span style={{ fontSize: "0.65rem", color: "#ef4444" }}>{o.deaths} ☠</span>}
                              <span style={{ fontSize: "0.6rem", color: "#2dd4bf" }}>→</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* State-wise outbreaks */}
          <div style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.85rem", fontWeight: 700 }}>
              State-wise Outbreaks
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", flex: 1 }}>
              {visibleStates.map(([state, info]) => (
                <Link key={state} href={stateLink(state)} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.6rem",
                    padding: "0.45rem 0.6rem", backgroundColor: "#0a1628", borderRadius: "7px",
                    border: "1px solid #1e3a5f", cursor: "pointer", transition: "border-color 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#2dd4bf")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e3a5f")}
                  >
                    <div style={{
                      minWidth: "22px", height: "22px", borderRadius: "50%",
                      backgroundColor: "#ef444420", border: "1px solid #ef444440",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.65rem", fontWeight: 800, color: "#f87171", fontFamily: "monospace", flexShrink: 0,
                    }}>
                      {info.count}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{state}</span>
                        <span style={{ fontSize: "0.6rem", color: "#2dd4bf", flexShrink: 0, marginLeft: "0.4rem" }}>→</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.6rem", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {info.diseases.slice(0, 3).join(" · ")}
                        </span>
                        {info.cases > 0 && <span style={{ fontSize: "0.6rem", color: "#fb923c", flexShrink: 0, marginLeft: "0.4rem" }}>{info.cases.toLocaleString()} cases</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {statesSorted.length > 8 && (
              <button onClick={() => setExpanded(e => !e)} style={{
                marginTop: "0.5rem", background: "none", border: "none", color: "#2dd4bf",
                fontSize: "0.7rem", cursor: "pointer", textAlign: "center", fontFamily: "inherit",
              }}>
                {expanded ? "▲ Show less" : `▼ Show ${statesSorted.length - 8} more states`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* District-level outbreak cards */}
      {!loading && outbreaks.length > 0 && (
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.7rem", fontWeight: 700 }}>
            District-level Detail · Official IDSP Data
          </div>
          <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "6px" }}>
            {outbreaks.slice(0, 20).map((o, i) => {
              const color    = diseaseColor(o.disease);
              const href     = resolveLink(o.district, o.state);
              const news     = o.newsLinks ?? [];
              const phi      = matchesPHI(o, phiItems);
              const totalCov = news.length + phi.length;
              const isOpen   = openNews === o.uid;
              return (
                <div key={i} style={{ flexShrink: 0, minWidth: "220px", maxWidth: "250px", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <Link href={href} style={{ textDecoration: "none" }}>
                    <div style={{
                      backgroundColor: "#080f1e", border: `1px solid ${color}30`, borderTop: `3px solid ${color}`,
                      borderRadius: "10px", padding: "0.85rem 1rem",
                      display: "flex", flexDirection: "column", gap: "0.3rem",
                      cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}25`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <span style={{ fontSize: "0.58rem", fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace" }}>
                        {o.disease}
                      </span>
                      <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>
                        {o.district}{o.district && o.state ? ", " : ""}{o.state}
                      </div>
                      <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.63rem", marginTop: "0.1rem" }}>
                        <span style={{ color: "#fb923c" }}>Cases: <b>{o.cases}</b></span>
                        {o.deaths > 0 && <span style={{ color: "#f87171" }}>Deaths: <b>{o.deaths}</b></span>}
                      </div>
                      {o.startDate && <span style={{ fontSize: "0.58rem", color: "#334155" }}>Started: {o.startDate}</span>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem" }}>
                        <span style={{ fontSize: "0.56rem", color: "#1e3a5f", fontFamily: "monospace" }}>{o.uid}</span>
                        <span style={{ fontSize: "0.6rem", color: "#2dd4bf" }}>Profile →</span>
                      </div>
                    </div>
                  </Link>

                  {/* News coverage button */}
                  {totalCov > 0 && (
                    <button
                      onClick={() => setOpenNews(isOpen ? null : o.uid)}
                      style={{
                        background: isOpen ? "#0d948830" : "#0f2040",
                        border: `1px solid ${isOpen ? "#0d9488" : "#1e3a5f"}`,
                        borderRadius: "7px", padding: "0.35rem 0.65rem",
                        color: isOpen ? "#2dd4bf" : "#64748b",
                        fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit", textAlign: "left",
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        width: "100%", transition: "all 0.15s",
                      }}
                    >
                      <span>📰</span>
                      <span>{totalCov} coverage item{totalCov !== 1 ? "s" : ""}</span>
                      <span style={{ marginLeft: "auto", fontSize: "0.6rem" }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                  )}

                  {/* Expanded news panel */}
                  {isOpen && (
                    <div style={{
                      backgroundColor: "#060d1a", border: "1px solid #1e3a5f",
                      borderRadius: "8px", padding: "0.6rem 0.75rem",
                      display: "flex", flexDirection: "column", gap: "0.5rem",
                    }}>
                      {news.map((n, ni) => (
                        <a key={ni} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                          <div style={{ padding: "0.4rem 0", borderBottom: ni < news.length - 1 || phi.length > 0 ? "1px solid #1e3a5f20" : "none" }}>
                            <div style={{ fontSize: "0.68rem", color: "#e2e8f0", lineHeight: 1.4, marginBottom: "0.15rem" }}>{n.title}</div>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.58rem", color: "#0d9488", fontWeight: 600 }}>{n.source}</span>
                              {n.publishedAt && <span style={{ fontSize: "0.56rem", color: "#334155" }}>{new Date(n.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                              <span style={{ fontSize: "0.56rem", color: "#475569", marginLeft: "auto" }}>↗ Read</span>
                            </div>
                          </div>
                        </a>
                      ))}
                      {phi.map((p, pi) => (
                        <div key={`phi-${pi}`} style={{ padding: "0.4rem 0", borderTop: pi === 0 && news.length > 0 ? "1px solid #1e3a5f" : "none" }}>
                          <div style={{ fontSize: "0.58rem", color: "#6366f1", fontWeight: 700, marginBottom: "0.1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>PHI Feed</div>
                          <div style={{ fontSize: "0.68rem", color: "#94a3b8", lineHeight: 1.4 }}>{p.title}</div>
                          <div style={{ fontSize: "0.58rem", color: "#475569", marginTop: "0.1rem" }}>{p.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ minWidth: "220px", height: "120px", backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "10px", flexShrink: 0, opacity: 0.5 }} />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .idsp-grid { grid-template-columns: 1fr !important; }
          .divider-v { display: none !important; }
        }
      `}</style>
    </div>
  );
}
