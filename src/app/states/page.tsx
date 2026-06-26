import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import statesRaw from "@/data/states.json";
import national from "@/data/national.json";

const PAGE = "https://health.vyasaa.com/states";

export const metadata: Metadata = {
  title: "NFHS-5 vs NFHS-6: State-wise Comparison & Analysis (All 36 States/UTs)",
  description:
    "Detailed NFHS-5 (2019-21) vs NFHS-6 (2023-24) comparison for all 36 Indian states and Union Territories — vaccination, stunting, wasting, underweight and institutional births, with the change and a trend analysis for each state. Plus SRS infant-mortality data.",
  keywords: [
    "NFHS-5 vs NFHS-6", "NFHS-6 vs NFHS-5", "NFHS-6 state wise data", "NFHS-6 state comparison",
    "NFHS-5 NFHS-6 comparison", "NFHS-6 vaccination by state", "NFHS-6 stunting state wise",
    "NFHS-6 institutional births state wise", "state wise NFHS data India", "NFHS-6 state fact sheet comparison",
    "India state health comparison 2023-24", "NFHS-6 analysis state", "NFHS 5 6 data analysis",
    "infant mortality rate by state India SRS", "NFHS-6 underweight wasting state",
  ],
  alternates: { canonical: PAGE },
  openGraph: {
    type: "article", url: PAGE,
    title: "NFHS-5 vs NFHS-6: State-wise Comparison & Analysis (All 36 States/UTs)",
    description: "Side-by-side NFHS-5 → NFHS-6 change for every Indian state and UT, with a trend analysis for each.",
    images: [{ url: "/og?title=NFHS-5+vs+NFHS-6+%E2%80%94+State-wise+Comparison", width: 1200, height: 630, alt: "NFHS-5 vs NFHS-6 state comparison" }],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

/* ── types & data ── */
interface S {
  slug: string; name: string;
  imr?: number; neonatalMR?: number; under5MR?: number;
  vaccinationPct?: number | null; stuntingPct?: number | null; underweightPct?: number | null;
  wastingPct?: number | null; institutionalBirthsPct?: number | null;
  womenAnaemiaPct?: number | null; anaemiaPct?: number | null;
  imrNFHS5?: number; nfhsRound?: number;
  [k: string]: unknown;
}
const states = statesRaw as unknown as S[];

const TEAL = "#0d9488", UP = "#2dd4bf", DOWN = "#f87171", FLAT = "#64748b";

const INDS = [
  { key: "vaccinationPct",         label: "Full child immunisation",  good: "up",   nat: national.vaccinationPct },
  { key: "institutionalBirthsPct", label: "Institutional births",     good: "up",   nat: national.institutionalBirthsPct },
  { key: "stuntingPct",            label: "Child stunting",           good: "down", nat: national.stuntingPct },
  { key: "wastingPct",             label: "Child wasting",            good: "down", nat: national.wastingPct },
  { key: "underweightPct",         label: "Child underweight",        good: "down", nat: national.underweightPct },
] as const;

function num(v: unknown): number | null { return typeof v === "number" ? v : null; }

function score(s: S): number {
  const imrS  = s.imr != null ? Math.max(0, 100 - (s.imr / 55) * 100) : 50;
  const vaccS = s.vaccinationPct != null ? s.vaccinationPct : 50;
  const ibS   = s.institutionalBirthsPct != null ? s.institutionalBirthsPct : 50;
  const stunS = s.stuntingPct != null ? Math.max(0, 100 - (s.stuntingPct / 50) * 100) : 50;
  const anaS  = s.womenAnaemiaPct != null ? Math.max(0, 100 - (s.womenAnaemiaPct / 75) * 100) : 50;
  return Math.round(imrS * 0.30 + vaccS * 0.25 + ibS * 0.20 + stunS * 0.15 + anaS * 0.10);
}

function rows(s: S) {
  return INDS.map((i) => {
    const n6 = num(s[i.key]);
    const n5 = num(s[`${i.key}_NFHS5`]);
    const d = n6 != null && n5 != null ? +(n6 - n5).toFixed(1) : null;
    const improved = d == null ? null : i.good === "up" ? d > 0 : d < 0;
    return { label: i.label, n5, n6, d, improved, nat: i.nat as number, good: i.good };
  });
}

function analyse(s: S, rank: number, total: number): string {
  if (s.nfhsRound === 5) {
    return `Manipur was not surveyed in NFHS-6 (2023-24). The figures shown are from NFHS-5 (2019-21): full immunisation ${s.vaccinationPct}%, stunting ${s.stuntingPct}%, institutional births ${s.institutionalBirthsPct}%. A direct NFHS-5 → NFHS-6 comparison is therefore not available for this state.`;
  }
  const r = rows(s).filter((x) => x.d != null) as { label: string; n5: number; n6: number; d: number; improved: boolean }[];
  const improvements = r.filter((x) => x.improved);
  const setbacks = r.filter((x) => !x.improved);
  const biggestGain = [...improvements].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const biggestSet = [...setbacks].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const vacc = num(s.vaccinationPct), stunt = num(s.stuntingPct);
  let t = `Between NFHS-5 (2019-21) and NFHS-6 (2023-24), ${s.name} improved on ${improvements.length} of ${r.length} tracked child-health indicators. `;
  if (biggestGain) t += `The biggest gain was ${biggestGain.label.toLowerCase()} (${biggestGain.n5}% → ${biggestGain.n6}%, ${biggestGain.d > 0 ? "+" : ""}${biggestGain.d} pp). `;
  if (biggestSet) t += `The main setback was ${biggestSet.label.toLowerCase()} (${biggestSet.n5}% → ${biggestSet.n6}%). `;
  if (vacc != null) t += `Full child immunisation now stands at ${vacc}% versus the national ${national.vaccinationPct}%. `;
  if (stunt != null) t += `Stunting is ${stunt}% (national ${national.stuntingPct}%) — ${stunt < national.stuntingPct ? "below" : "above"} the India average. `;
  if (s.imr != null) t += `Infant mortality (SRS) is ${s.imr} per 1,000 live births. `;
  t += `On Vyasa's composite health score it ranks #${rank} of ${total}.`;
  return t;
}

export default function StatesPage() {
  const ranked = [...states].map((s) => ({ s, sc: score(s) })).sort((a, b) => b.sc - a.sc);
  const total = ranked.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "NFHS-5 vs NFHS-6: State-wise Comparison & Analysis (All 36 States/UTs)",
        description: "Detailed NFHS-5 (2019-21) to NFHS-6 (2023-24) comparison and trend analysis for every Indian state and Union Territory.",
        datePublished: "2026-06-26", dateModified: "2026-06-26",
        author: { "@type": "Organization", name: "Vyasa Health", url: "https://health.vyasaa.com" },
        publisher: { "@type": "Organization", name: "Vyasa Health", logo: { "@type": "ImageObject", url: "https://health.vyasaa.com/icons/icon.svg" } },
        mainEntityOfPage: PAGE,
      },
      {
        "@type": "Dataset",
        name: "NFHS-5 vs NFHS-6 state-wise key indicators (India)",
        description: "Vaccination, stunting, wasting, underweight and institutional births for all 36 Indian states/UTs, NFHS-5 (2019-21) and NFHS-6 (2023-24). Source: IIPS/MoHFW; infant mortality from SRS (RGI).",
        creator: { "@type": "Organization", name: "International Institute for Population Sciences (IIPS)" },
        temporalCoverage: "2019/2024", spatialCoverage: "India", url: PAGE,
      },
      {
        "@type": "ItemList",
        itemListElement: ranked.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.s.name, url: `https://health.vyasaa.com/state/${x.s.slug}` })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://health.vyasaa.com" },
          { "@type": "ListItem", position: 2, name: "NFHS-5 vs NFHS-6 — States", item: PAGE },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2.5rem 1.5rem 6rem" }}>
      <JsonLd data={jsonLd} />

      <div style={badge}><span style={badgeTxt}>State-wise · NFHS-5 → NFHS-6</span></div>
      <h1 className="font-display" style={{ fontSize: "clamp(1.9rem, 5vw, 3rem)", fontWeight: 700, color: "#fff", lineHeight: 1.12, marginBottom: "1rem" }}>
        NFHS-5 vs NFHS-6: State &amp; UT Comparison
      </h1>
      <p style={{ fontSize: "1.02rem", color: "#94a3b8", lineHeight: 1.8, maxWidth: "780px" }}>
        Every Indian state and Union Territory, with <strong style={{ color: "#cbd5e1" }}>both the NFHS-5 (2019-21) and NFHS-6 (2023-24) value</strong> and
        the change for vaccination, stunting, wasting, underweight and institutional births — plus a detailed trend analysis for each.
        Tap <em>View detailed analysis</em> on any state. Infant mortality is from SRS (RGI). Manipur was not surveyed in NFHS-6.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", margin: "1.25rem 0 0.5rem", fontSize: "0.8rem", color: "#64748b" }}>
        <span><span style={{ color: UP }}>▲ teal</span> = improved</span>
        <span><span style={{ color: DOWN }}>▼ red</span> = worsened</span>
        <span>Ranked by composite health score (IMR, vaccination, institutional births, stunting, anaemia)</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginTop: "1.5rem" }}>
        {ranked.map(({ s, sc }, idx) => {
          const rank = idx + 1;
          const r = rows(s);
          const scoreColour = sc >= 70 ? UP : sc >= 55 ? "#fbbf24" : DOWN;
          return (
            <details key={s.slug} style={card}>
              <summary style={summary}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", color: "#475569", width: 22, textAlign: "right" }}>{rank}</span>
                  <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.98rem" }}>{s.name}</span>
                  {s.nfhsRound === 5 && <span style={tag}>NFHS-5 only</span>}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.9rem", flexShrink: 0 }}>
                  {/* quick deltas */}
                  {r.filter((x) => x.d != null).slice(0, 3).map((x) => (
                    <span key={x.label} title={x.label} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.74rem", color: x.improved ? UP : DOWN }}>
                      {x.improved ? "▲" : "▼"}{x.d! > 0 ? "+" : ""}{x.d}
                    </span>
                  ))}
                  <span style={{ ...scoreBadge, color: scoreColour, borderColor: scoreColour + "55" }}>{sc}</span>
                  <span style={{ color: "#475569", fontSize: "0.8rem" }}>▾</span>
                </span>
              </summary>

              {/* expanded */}
              <div style={{ padding: "0.5rem 0.25rem 0.25rem" }}>
                <div style={tableWrap}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                    <thead><tr>
                      <th style={{ ...th, textAlign: "left" }}>Indicator (%)</th>
                      <th style={th}>NFHS-5</th><th style={th}>NFHS-6</th><th style={th}>Change</th><th style={th}>India (N6)</th>
                    </tr></thead>
                    <tbody>
                      {r.map((x) => (
                        <tr key={x.label} style={{ borderTop: "1px solid #16243d" }}>
                          <td style={{ ...td, textAlign: "left", color: "#cbd5e1" }}>{x.label}</td>
                          <td style={{ ...td, color: "#94a3b8" }}>{x.n5 ?? "—"}</td>
                          <td style={{ ...td, color: "#e2e8f0", fontWeight: 700 }}>{x.n6 ?? "—"}</td>
                          <td style={{ ...td, color: x.improved == null ? FLAT : x.improved ? UP : DOWN, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                            {x.d == null ? "—" : `${x.improved ? "▲" : "▼"} ${x.d > 0 ? "+" : ""}${x.d}`}
                          </td>
                          <td style={{ ...td, color: "#64748b" }}>{x.nat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* vitals */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.85rem" }}>
                  {s.imr != null && <Vital label="Infant Mortality (SRS)" v={`${s.imr}`} u="/1,000" />}
                  {s.under5MR != null && <Vital label="Under-5 Mortality" v={`${s.under5MR}`} u="/1,000" />}
                  {s.womenAnaemiaPct != null && <Vital label="Women Anaemia (NFHS-5)" v={`${s.womenAnaemiaPct}%`} u="" />}
                </div>

                {/* analysis */}
                <div style={{ borderLeft: `3px solid ${TEAL}`, padding: "0.5rem 0 0.5rem 1rem", margin: "1rem 0 0.5rem" }}>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8", lineHeight: 1.75 }}>{analyse(s, rank, total)}</p>
                </div>

                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <Link href={`/state/${s.slug}`} style={cta}>Full {s.name} dashboard →</Link>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div style={{ marginTop: "2.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link href="/nfhs-6" style={cta}>National NFHS-6 vs NFHS-5 analysis →</Link>
        <Link href="/sources" style={ctaGhost}>Data sources</Link>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#475569", marginTop: "1.75rem", lineHeight: 1.7 }}>
        Source: <em>National Family Health Survey (NFHS-6), 2023-24 and NFHS-5, 2019-21 — India and State/UT Fact Sheets</em>, IIPS for MoHFW, Government of India.
        Infant and under-5 mortality from the Sample Registration System (SRS), Registrar General of India. Anaemia is shown from NFHS-5 (not reported in the NFHS-6 fact sheet).
        NFHS-6 results are provisional. Independent analysis for transparency and education; not medical advice.
      </p>
    </div>
  );
}

function Vital({ label, v, u }: { label: string; v: string; u: string }) {
  return (
    <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "0.5rem 0.8rem" }}>
      <div style={{ fontSize: "0.66rem", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: UP, fontFamily: "'IBM Plex Mono', monospace" }}>{v}<span style={{ fontSize: "0.62rem", color: "#475569" }}> {u}</span></div>
    </div>
  );
}

/* ── styles ── */
const badge = { display: "inline-flex", gap: "0.5rem", background: "#0d948820", border: "1px solid #0d948840", borderRadius: 20, padding: "0.3rem 0.85rem", marginBottom: "1.25rem" } as const;
const badgeTxt = { fontSize: "0.72rem", color: "#2dd4bf", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" } as const;
const card = { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10 } as const;
const summary = { cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.85rem 1rem" } as const;
const tag = { fontSize: "0.6rem", color: "#fbbf24", border: "1px solid #fbbf2440", borderRadius: 6, padding: "1px 6px" } as const;
const scoreBadge = { fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem", fontWeight: 800, border: "1px solid", borderRadius: 6, padding: "1px 8px", minWidth: 34, textAlign: "center" } as const;
const tableWrap = { overflowX: "auto" as const, border: "1px solid #16243d", borderRadius: 8 };
const th = { padding: "0.5rem 0.6rem", textAlign: "center" as const, fontSize: "0.68rem", color: "#94a3b8", background: "#0f2040", textTransform: "uppercase" as const, fontWeight: 600 };
const td = { padding: "0.5rem 0.6rem", textAlign: "center" as const };
const cta = { background: TEAL, color: "#fff", borderRadius: 8, padding: "0.55rem 1rem", fontSize: "0.83rem", fontWeight: 700, textDecoration: "none" } as const;
const ctaGhost = { background: "#0f2040", border: "1px solid #1e3a5f", color: "#cbd5e1", borderRadius: 8, padding: "0.55rem 1rem", fontSize: "0.83rem", fontWeight: 600, textDecoration: "none" } as const;
