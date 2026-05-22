import type { Metadata } from "next";
import { adminList } from "@/lib/firestore-admin";
import type { IDSPOutbreak } from "@/lib/idspPDFParser";
import Link from "next/link";
import IDSPStateGrid, { type StateRow } from "@/components/IDSPStateGrid";
import IDSPDiseaseBreakdown, { type DiseaseStatRow } from "@/components/IDSPDiseaseBreakdown";

export const metadata: Metadata = {
  title: "IDSP Outbreak Surveillance | Vyasa",
  description:
    "Year-to-date disease outbreak data from India's Integrated Disease Surveillance Programme (IDSP). Cumulative cases, deaths, and state-wise breakdown for researchers.",
};

export const revalidate = 21600;

type WeekDoc = {
  _id: string;
  week?: number;
  year?: number;
  dateRange?: string;
  totalOutbreaks?: number;
  reportingStates?: number;
  pdfUrl?: string;
  fetchedAt?: string;
  outbreaks?: IDSPOutbreak[];
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function IDSPPage() {
  const currentYear = new Date().getFullYear();

  let allDocs: WeekDoc[] = [];
  try {
    const raw = await adminList("idsp_weekly", 200);
    allDocs = (raw as WeekDoc[]).filter(d => /^\d{4}_w\d{2}$/.test(String(d._id)));
  } catch { /* render empty */ }

  const availableYears = [...new Set(allDocs.map(d => d.year ?? parseInt(String(d._id).slice(0, 4))))].sort((a, b) => b - a);
  const year = availableYears[0] ?? currentYear;

  const yearDocs = allDocs
    .filter(d => (d.year ?? parseInt(String(d._id).slice(0, 4))) === year)
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));

  const weeksInOrder = yearDocs.map(d => d.week ?? parseInt(String(d._id).slice(6)));

  // ── Deduplicate by UID for YTD totals ──────────────────────────────────────
  const uidWeekMap = new Map<string, number>();
  const latestByUid = new Map<string, IDSPOutbreak>();
  for (const doc of yearDocs) {
    const w = doc.week ?? 0;
    for (const o of doc.outbreaks ?? []) {
      const prevWeek = uidWeekMap.get(o.uid) ?? -1;
      if (w > prevWeek) { uidWeekMap.set(o.uid, w); latestByUid.set(o.uid, o); }
    }
  }
  const allOutbreaks = [...latestByUid.values()];

  const ytdOutbreaks = allOutbreaks.length;
  const ytdCases    = allOutbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
  const ytdDeaths   = allOutbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0);
  const ytdStates   = new Set(allOutbreaks.map(o => o.state)).size;
  const weeksReported = yearDocs.length;

  // ── Disease breakdown (YTD, deduplicated) ──────────────────────────────────
  const diseaseMap = new Map<string, { outbreaks: number; cases: number; deaths: number }>();
  for (const o of allOutbreaks) {
    const d = diseaseMap.get(o.disease) ?? { outbreaks: 0, cases: 0, deaths: 0 };
    d.outbreaks++; d.cases += o.cases ?? 0; d.deaths += o.deaths ?? 0;
    diseaseMap.set(o.disease, d);
  }
  const diseaseBreakdown = [...diseaseMap.entries()].sort((a, b) => b[1].outbreaks - a[1].outbreaks).slice(0, 20);

  // ── Per-disease state breakdown (for interactive drill-down) ───────────────
  const diseaseStateMap = new Map<string, Map<string, { outbreaks: number; cases: number; deaths: number }>>();
  for (const o of allOutbreaks) {
    if (!diseaseStateMap.has(o.disease)) diseaseStateMap.set(o.disease, new Map());
    const sm = diseaseStateMap.get(o.disease)!;
    const prev = sm.get(o.state) ?? { outbreaks: 0, cases: 0, deaths: 0 };
    prev.outbreaks++; prev.cases += o.cases ?? 0; prev.deaths += o.deaths ?? 0;
    sm.set(o.state, prev);
  }
  const diseaseRows: DiseaseStatRow[] = diseaseBreakdown.map(([disease, stat]) => ({
    disease,
    ...stat,
    states: [...(diseaseStateMap.get(disease) ?? new Map()).entries()]
      .map(([state, s]) => ({ state, slug: toSlug(state), ...s }))
      .sort((a, b) => b.outbreaks - a.outbreaks),
  }));

  // ── State × Week matrix (raw weekly counts — NOT deduplicated) ─────────────
  // For the heat map we want "how many cases reported in this state in THIS WEEK's PDF"
  // so we show genuine weekly activity, not cumulative YTD.
  const stateRowMap = new Map<string, StateRow>();
  for (const doc of yearDocs) {
    const w = doc.week ?? 0;
    const dr = doc.dateRange ?? "";
    for (const o of doc.outbreaks ?? []) {
      if (!stateRowMap.has(o.state)) {
        stateRowMap.set(o.state, {
          state: o.state,
          slug: toSlug(o.state),
          total: { outbreaks: 0, cases: 0, deaths: 0 },
          byWeek: {},
          diseases: [],
        });
      }
      const row = stateRowMap.get(o.state)!;
      if (!row.byWeek[w]) row.byWeek[w] = { outbreaks: 0, cases: 0, deaths: 0, dateRange: dr, diseases: [] };
      row.byWeek[w].outbreaks++;
      row.byWeek[w].cases  += o.cases ?? 0;
      row.byWeek[w].deaths += o.deaths ?? 0;
      if (!row.byWeek[w].diseases!.includes(o.disease)) row.byWeek[w].diseases!.push(o.disease);
    }
  }
  // Compute per-state YTD totals from the deduplicated set
  for (const o of allOutbreaks) {
    const row = stateRowMap.get(o.state);
    if (!row) continue;
    row.total.outbreaks++;
    row.total.cases  += o.cases ?? 0;
    row.total.deaths += o.deaths ?? 0;
    if (!row.diseases.includes(o.disease)) row.diseases.push(o.disease);
  }
  const stateRows: StateRow[] = [...stateRowMap.values()]
    .sort((a, b) => b.total.outbreaks - a.total.outbreaks);

  // ── Per-week snapshots for trend table ─────────────────────────────────────
  const weekSnapshots = yearDocs.map(doc => ({
    week:      doc.week ?? parseInt(String(doc._id).slice(6)),
    dateRange: doc.dateRange ?? "",
    outbreaks: doc.totalOutbreaks ?? (doc.outbreaks?.length ?? 0),
    cases:     doc.outbreaks?.reduce((s, o) => s + (o.cases ?? 0), 0) ?? 0,
    deaths:    doc.outbreaks?.reduce((s, o) => s + (o.deaths ?? 0), 0) ?? 0,
    reporting: doc.reportingStates ?? 0,
    pdfUrl:    doc.pdfUrl ?? "",
  }));
  const maxWeekCases = Math.max(...weekSnapshots.map(w => w.cases), 1);
  const latestWeekNum = yearDocs[yearDocs.length - 1]?.week ?? 0;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem 6rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            backgroundColor: "#7f1d1d30", border: "1px solid #ef444440",
            borderRadius: "20px", padding: "0.3rem 0.85rem",
            fontSize: "0.72rem", color: "#f87171", letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace",
          }}>
            🇮🇳 NCDC · MoHFW · Official
          </span>
          <span style={{ fontSize: "0.72rem", color: "#475569" }}>
            Scraped weekly from{" "}
            <a href="https://idsp.mohfw.gov.in" target="_blank" rel="noopener noreferrer"
              style={{ color: "#64748b", textDecoration: "underline" }}>idsp.mohfw.gov.in</a>
          </span>
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>
          IDSP Outbreak Surveillance
        </h1>
        <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.7, maxWidth: "640px" }}>
          Year-to-date cumulative burden from India&apos;s Integrated Disease Surveillance Programme.
          Each outbreak counted once using its latest reported case count.
          Covering {ordinal(weeksReported)} weeks of {year}.
        </p>
      </div>

      {/* YTD Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "0.75rem", marginBottom: "2.5rem" }}>
        {[
          { label: "Unique Outbreaks", value: ytdOutbreaks.toLocaleString(), icon: "🦠", color: "#f97316" },
          { label: "Total Cases (YTD)", value: ytdCases.toLocaleString(), icon: "🧑‍⚕️", color: "#fb923c" },
          { label: "Total Deaths (YTD)", value: ytdDeaths.toLocaleString(), icon: "☠", color: "#ef4444" },
          { label: "States Affected", value: ytdStates.toString(), icon: "📍", color: "#a78bfa" },
          { label: "Weeks on Record", value: `${weeksReported} / 52`, icon: "📅", color: "#38bdf8" },
        ].map(c => (
          <div key={c.label} style={{
            backgroundColor: "#0f172a", border: "1px solid #1e293b",
            borderRadius: "12px", padding: "1.1rem 1.25rem",
          }}>
            <div style={{ fontSize: "1.3rem", marginBottom: "0.3rem" }}>{c.icon}</div>
            <div style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 700, color: c.color, fontFamily: "'IBM Plex Mono', monospace" }}>
              {c.value}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.2rem" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── All-States Heat Map ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem" }}>
          <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0" }}>
            All States — Week-by-Week Trend
          </h2>
          <span style={{ fontSize: "0.72rem", color: "#475569" }}>
            Click any state row to expand week-by-week detail
          </span>
        </div>
        <IDSPStateGrid stateRows={stateRows} weeks={weeksInOrder} year={year} />
      </section>

      {/* ── Weekly trend table ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>
          Weekly Summary — {year}
        </h2>
        <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem 0.5rem", borderBottom: "1px solid #1e293b" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "60px" }}>
              {weekSnapshots.map(w => {
                const pct = Math.max(4, (w.cases / maxWeekCases) * 100);
                return (
                  <div key={w.week} title={`Week ${w.week}: ${w.cases.toLocaleString()} cases`} style={{
                    flex: 1, backgroundColor: w.week === latestWeekNum ? "#f97316" : "#1e3a5f",
                    height: `${pct}%`, borderRadius: "3px 3px 0 0", minWidth: "4px",
                  }} />
                );
              })}
            </div>
            <div style={{ fontSize: "0.62rem", color: "#475569", marginTop: "0.3rem" }}>
              Cases per week · orange = latest
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#0a1628" }}>
                  {["Week", "Date Range", "Outbreaks", "Cases", "Deaths", "States", "PDF"].map(h => (
                    <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekSnapshots.map((w, i) => (
                  <tr key={w.week} style={{
                    backgroundColor: w.week === latestWeekNum ? "#0f2040" : (i % 2 === 0 ? "#0f172a" : "#0a1020"),
                    borderTop: "1px solid #1e293b",
                  }}>
                    <td style={{ padding: "0.6rem 1rem", color: w.week === latestWeekNum ? "#f97316" : "#94a3b8", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {ordinal(w.week)}{w.week === latestWeekNum && <span style={{ fontSize: "0.6rem", marginLeft: "0.3rem" }}>●</span>}
                    </td>
                    <td style={{ padding: "0.6rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{w.dateRange || "—"}</td>
                    <td style={{ padding: "0.6rem 1rem", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>{w.outbreaks}</td>
                    <td style={{ padding: "0.6rem 1rem", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{w.cases.toLocaleString()}</td>
                    <td style={{ padding: "0.6rem 1rem", color: w.deaths > 0 ? "#ef4444" : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{w.deaths}</td>
                    <td style={{ padding: "0.6rem 1rem", color: "#94a3b8" }}>{w.reporting}/36</td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {w.pdfUrl ? (
                        <a href={w.pdfUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.7rem", color: "#f87171", textDecoration: "none", border: "1px solid #ef444440", borderRadius: "6px", padding: "0.2rem 0.5rem" }}>
                          PDF ↗
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Disease Breakdown + State Breakdown ────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
        <section>
          <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.4rem" }}>
            Disease Breakdown — {year} YTD
          </h2>
          <p style={{ fontSize: "0.72rem", color: "#475569", marginBottom: "1rem" }}>Click any disease to see affected states</p>
          <IDSPDiseaseBreakdown rows={diseaseRows} />
        </section>

        <section>
          <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>
            State Burden — {year} YTD
          </h2>
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#0a1628" }}>
                  {["State", "Outbreaks", "Cases", "Deaths"].map(h => (
                    <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", color: "#475569", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stateRows.map(({ state, slug, total }, i) => (
                  <tr key={state} style={{ backgroundColor: i % 2 === 0 ? "#0f172a" : "#0a1020", borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "0.55rem 0.85rem" }}>
                      <Link href={`/state/${slug}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{state}</Link>
                    </td>
                    <td style={{ padding: "0.55rem 0.85rem", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>{total.outbreaks}</td>
                    <td style={{ padding: "0.55rem 0.85rem", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace" }}>{total.cases.toLocaleString()}</td>
                    <td style={{ padding: "0.55rem 0.85rem", color: total.deaths > 0 ? "#ef4444" : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{total.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Methodology */}
      <div style={{
        backgroundColor: "#0f172a", border: "1px solid #1e293b",
        borderRadius: "12px", padding: "1.25rem 1.5rem",
        fontSize: "0.78rem", color: "#475569", lineHeight: 1.7,
      }}>
        <strong style={{ color: "#64748b" }}>Methodology:</strong>{" "}
        Weekly IDSP PDFs are scraped automatically from idsp.mohfw.gov.in.
        Each outbreak carries a unique ID (e.g. AP/EAS/2026/05/123).
        YTD totals use each outbreak&apos;s <em>latest reported case count</em> to avoid double-counting.
        The heat map above shows the raw cases per state per week as reported in each week&apos;s PDF —
        not deduplicated, so ongoing outbreaks appear in every week they are active.
        Data may lag the source by up to 7 days. Not for clinical use.
      </div>
    </div>
  );
}
