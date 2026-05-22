import { notFound } from "next/navigation";
import Link from "next/link";
import states from "@/data/states.json";
import cities from "@/data/cities.json";
import { fetchHealthCentres } from "@/lib/api";
import { readFile } from "fs/promises";
import path from "path";
import CityCard from "@/components/CityCard";
import NearbyHealthCentres from "@/components/NearbyHealthCentres";
import StateCharts from "./StateCharts";
import HealthCategories from "@/components/HealthCategories";
import AIAnalysisCard from "@/components/AIAnalysisCard";
import JsonLd from "@/components/JsonLd";
import type { OutbreakAlert, IDSPRecord, HospitalBedsRecord } from "@/lib/idsp";
import { fsGet } from "@/lib/firestore";
import type { IDSPOutbreak } from "@/lib/idspPDFParser";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const s = states.find(st => st.slug === params.slug);
  if (!s) return {};
  const score = healthScore(s);
  const desc = [
    `${s.name} public health data: IMR ${s.imr ?? "N/A"}/1,000 live births`,
    s.vaccinationPct != null ? `${s.vaccinationPct}% vaccination coverage` : null,
    s.institutionalBirthsPct != null ? `${s.institutionalBirthsPct}% institutional births` : null,
    `health score ${score}/100.`,
    "Source: NFHS-5, SRS 2023, IDSP, MoHFW.",
  ].filter(Boolean).join(", ");
  const url = `https://vyasaa.com/state/${s.slug}`;
  return {
    title: `${s.name} — IMR, Vaccination & Disease Surveillance Data`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${s.name} Public Health Dashboard | Vyasa`,
      description: desc,
      url,
      images: [{ url: `/og?title=${encodeURIComponent(s.name + " Public Health Data")}&sub=${encodeURIComponent(`IMR ${s.imr ?? "N/A"}/1000 · ${s.vaccinationPct ?? "?"}% vaccinated · Health Score ${score}/100`)}&state=${encodeURIComponent(s.name)}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: `${s.name} Health Data | Vyasa`, description: desc, images: [`/og?title=${encodeURIComponent(s.name + " Public Health Data")}&state=${encodeURIComponent(s.name)}`] },
  };
}

async function getIDSPCache() {
  try {
    const raw = await readFile(path.join(process.cwd(), "src/data/idsp-cache.json"), "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

function normalizeStateName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/andaman.*nicobar/g, "andamannicobar");
}

async function getIDSPWeeklyForState(stateName: string): Promise<{ outbreaks: OutbreakAlert[]; weekLabel: string }> {
  try {
    const data = await fsGet("idsp_weekly", "latest_v6") as { week: number; year: number; outbreaks: IDSPOutbreak[] } | null;
    if (!data?.outbreaks?.length) return { outbreaks: [], weekLabel: "" };
    const norm = normalizeStateName(stateName);
    const normWords = norm.split(/\s+/).filter(w => w.length > 2);
    const filtered = data.outbreaks.filter(o => {
      const oNorm = normalizeStateName(o.state);
      return normWords.every(w => oNorm.includes(w));
    });
    const converted: OutbreakAlert[] = filtered.map(o => ({
      id: o.uid,
      disease: o.disease,
      state: o.state,
      district: o.district || undefined,
      cases: o.cases,
      deaths: o.deaths,
      status: (o.status === "active" || o.status === "contained" || o.status === "monitoring") ? o.status : "active",
      reportDate: o.reportDate || o.startDate,
      source: "IDSP MoHFW Weekly",
    }));
    const weekLabel = data.week && data.year ? `IDSP Week ${data.week}, ${data.year}` : "IDSP Surveillance";
    return { outbreaks: converted, weekLabel };
  } catch { return { outbreaks: [], weekLabel: "" }; }
}

function healthScore(s: typeof states[number]): number {
  const imrS   = s.imr                    != null ? Math.max(0, 100 - (s.imr / 55) * 100)              : 50;
  const vaccS  = s.vaccinationPct         != null ? s.vaccinationPct                                    : 50;
  const ibS    = s.institutionalBirthsPct != null ? s.institutionalBirthsPct                            : 50;
  const stuntS = s.stuntingPct            != null ? Math.max(0, 100 - (s.stuntingPct / 50) * 100)      : 50;
  const anaemS = s.womenAnaemiaPct        != null ? Math.max(0, 100 - (s.womenAnaemiaPct / 75) * 100)  : 50;
  return Math.round(imrS * 0.30 + vaccS * 0.25 + ibS * 0.20 + stuntS * 0.15 + anaemS * 0.10);
}
function scoreColor(v: number) {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}


export default async function StatePage({ params }: { params: { slug: string } }) {
  const state = states.find((s) => s.slug === params.slug);
  if (!state) notFound();

  const stateCities = cities.filter((c) => c.stateSlug === state.slug);
  const score = healthScore(state);
  const col   = scoreColor(score);

  const [liveHospitals, idspCache, idspWeekly] = await Promise.all([
    fetchHealthCentres(state.phcStateName),
    getIDSPCache(),
    getIDSPWeeklyForState(state.name),
  ]);

  const stateNameWords = state.name.toLowerCase().split(/\s+/);
  function stateMatches(field: string) {
    const low = field.toLowerCase();
    return stateNameWords.every(w => low.includes(w));
  }
  const stateOutbreaks: OutbreakAlert[] = (idspCache?.outbreaks ?? []).filter(
    (a: OutbreakAlert) => stateMatches(a.state)
  );
  const legacyOutbreaks: OutbreakAlert[] = stateOutbreaks.length > 0 ? stateOutbreaks : (idspCache?.nhpAlerts ?? []).slice(0, 4);
  const allOutbreaks: OutbreakAlert[] = idspWeekly.outbreaks.length > 0 ? idspWeekly.outbreaks : legacyOutbreaks;
  const diseaseRecords: IDSPRecord[] = (idspCache?.diseaseRecords ?? []).filter(
    (r: IDSPRecord) => stateMatches(r.state)
  );
  const stateBeds = (idspCache?.hospitalBeds ?? []).find(
    (b: HospitalBedsRecord) => stateMatches(b.state)
  );

  const aiMetrics = {
    imr:          state.imr,
    neonatalMR:   state.neonatalMR,
    under5MR:     state.under5MR,
    vaccPct:      state.vaccinationPct,
    stuntingPct:  state.stuntingPct,
    wastingPct:   state.wastingPct,
    underweightPct: state.underweightPct,
    instBirths:   state.institutionalBirthsPct,
    womenAnaemia: state.womenAnaemiaPct,
    anaemia:      state.anaemiaPct,
    birthRate:    state.birthRate2023,
    deathRate:    state.deathRate2023,
    phcTotal:     liveHospitals?.phcTotal,
    chcTotal:     liveHospitals?.chcTotal,
    healthScore:  score,
  };

  const ranked = [...states].map(s => healthScore(s)).sort((a,b) => b - a);
  const rank = ranked.indexOf(score) + 1;

  const stateUrl = `https://vyasaa.com/state/${state.slug}`;

  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": `${state.name} Public Health Statistics`,
        "description": `Comprehensive health data for ${state.name}: IMR, vaccination coverage, institutional births, stunting, anaemia and disease surveillance.`,
        "url": stateUrl,
        "creator": { "@type": "Organization", "name": "Vyasa Health" },
        "spatialCoverage": { "@type": "State", "name": state.name, "containedInPlace": { "@type": "Country", "name": "India" } },
        "variableMeasured": [
          { "@type": "PropertyValue", "name": "Infant Mortality Rate", "value": state.imr, "unitText": "per 1,000 live births" },
          { "@type": "PropertyValue", "name": "Vaccination Coverage", "value": state.vaccinationPct, "unitText": "%" },
          { "@type": "PropertyValue", "name": "Health Score", "value": score, "unitText": "/100" },
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "India", "item": "https://www.vyasaa.com" },
          { "@type": "ListItem", "position": 2, "name": state.name, "item": stateUrl },
        ],
      }} />

      {/* ── BREADCRUMB BAR ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", gap: "0.4rem", height: "38px", fontSize: "0.78rem", color: "#475569" }}>
          <Link href="/" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 500 }}>India</Link>
          <span>›</span>
          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{state.name}</span>
          <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#334155" }}>SRS 2023 · NFHS-5 · IDSP</span>
        </div>
      </div>

      {/* ── STATE HEADER ───────────────────────────────────────────── */}
      <div id="overview" style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "1.75rem 1.5rem 0", scrollMarginTop: "64px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

          {/* Title row */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "0.2rem" }}>
                {state.name}
              </h1>
              <p style={{ fontSize: "0.8rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                State Health Dashboard · India
              </p>
              {/* Source pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.6rem" }}>
                {[
                  { l: "SRS 2023", c: "#0d9488" },
                  { l: "NFHS-5 2019–21", c: "#6366f1" },
                  ...(liveHospitals ? [{ l: "NHP RHS Live", c: "#2dd4bf" }] : []),
                  ...(idspCache ? [{ l: "IDSP Surveillance", c: "#eab308" }] : []),
                ].map(s => (
                  <span key={s.l} style={{ fontSize: "0.62rem", color: s.c, backgroundColor: `${s.c}18`, border: `1px solid ${s.c}40`, borderRadius: "4px", padding: "0.12rem 0.45rem", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {s.l}
                  </span>
                ))}
              </div>
            </div>

            {/* Health score ring */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ textAlign: "center" }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#1e3a5f" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={col} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 34 * score / 100} ${2 * Math.PI * 34 * (1 - score / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: "stroke-dasharray 0.6s ease" }}
                  />
                  <text x="40" y="44" textAnchor="middle" fill={col} fontSize="16" fontWeight="bold" fontFamily="monospace">{score}</text>
                </svg>
                <div style={{ fontSize: "0.62rem", color: "#475569", marginTop: "0.2rem" }}>Health Score</div>
                <div style={{ fontSize: "0.6rem", color: "#334155" }}>Rank #{rank}</div>
              </div>
            </div>
          </div>

          {/* Key stats bar */}
          <div className="header-stats-bar" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0" }}>
            {[
              { label: "IMR (2023)",    value: state.imr != null ? `${state.imr}` : "—",                              unit: "/1k LB",  color: state.imr != null && state.imr <= 20 ? "#22c55e" : "#f97316" },
              { label: "Vaccination",   value: state.vaccinationPct != null ? `${state.vaccinationPct}%` : "—",        unit: "coverage", color: "#2dd4bf" },
              { label: "Inst. Births",  value: state.institutionalBirthsPct != null ? `${state.institutionalBirthsPct}%` : "—", unit: "in facility", color: "#6366f1" },
              { label: "Stunting",      value: state.stuntingPct != null ? `${state.stuntingPct}%` : "—",              unit: "children", color: "#eab308" },
              { label: "PHCs",          value: liveHospitals ? String(liveHospitals.phcTotal) : "—",                   unit: "facilities", color: "#94a3b8" },
              { label: "Birth Rate",    value: state.birthRate2023 != null ? `${state.birthRate2023}` : "—",           unit: "/1k pop",  color: "#64748b" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "0.85rem 1rem", borderLeft: i > 0 ? "1px solid #1e3a5f" : "none", textAlign: "center" }}>
                <div className="font-data" style={{ fontSize: "1.25rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "0.6rem", color: "#475569", marginTop: "0.2rem" }}>{s.label}</div>
                <div style={{ fontSize: "0.58rem", color: "#334155" }}>{s.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PAGE BODY ────────────────────────────────────────────── */}
      <div className="page-body-wrapper">
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* AI Analysis */}
          <div id="ai-analysis" style={{ scrollMarginTop: "90px" }}>
            <AIAnalysisCard name={state.name} level="state" metrics={aiMetrics} />
          </div>

          {/* All health sections */}
          <HealthCategories
            level="state"
            stateName={state.name}
            imrSRS2023={state.imr}
            imrNFHS5={state.imrNFHS5}
            imrRural={state.imrRural2023 ?? null}
            imrUrban={state.imrUrban2023 ?? null}
            neonatalMR={state.neonatalMR ?? null}
            under5MR={state.under5MR ?? null}
            birthRate={state.birthRate2023 ?? null}
            deathRate={state.deathRate2023 ?? null}
            outbreaks={allOutbreaks}
            idspWeekLabel={idspWeekly.weekLabel || undefined}
            diseaseRecords={diseaseRecords}
            anaemiaPct={state.anaemiaPct ?? null}
            womenAnaemiaPct={state.womenAnaemiaPct ?? null}
            vaccinationPct={state.vaccinationPct ?? null}
            instBirthsPct={state.institutionalBirthsPct ?? null}
            stuntingPct={state.stuntingPct ?? null}
            wastingPct={state.wastingPct ?? null}
            underweightPct={state.underweightPct ?? null}
            phcTotal={liveHospitals?.phcTotal}
            chcTotal={liveHospitals?.chcTotal}
            hospitalBeds={stateBeds?.totalBeds}
          />

          {/* PHC / CHC finder */}
          <div id="facilities" style={{ scrollMarginTop: "90px", marginTop: "2rem" }}>
            <NearbyHealthCentres stateName={state.name} />
          </div>

          {/* Districts / Cities */}
          <section id="districts" style={{ marginTop: "2rem", scrollMarginTop: "90px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1rem" }}>🗺️</span>
                <h2 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>Districts & Cities</h2>
              </div>
              {stateCities.length > 0 && (
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{stateCities.length} CPCB monitoring stations</span>
              )}
            </div>
            {stateCities.length === 0 ? (
              <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "2rem", textAlign: "center", color: "#475569", fontSize: "0.88rem" }}>
                No CPCB monitoring stations in this state/UT.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.85rem" }}>
                {stateCities.map((city) => <CityCard key={city.slug} city={city} />)}
              </div>
            )}
          </section>

          {/* Historical Trends & Correlations — collapsible */}
          <StateCharts
            stateName={state.name}
            metrics={{
              imr:            state.imr,
              neonatalMR:     state.neonatalMR,
              under5MR:       state.under5MR,
              vaccinationPct: state.vaccinationPct,
              stuntingPct:    state.stuntingPct,
              wastingPct:     state.wastingPct,
              underweightPct: state.underweightPct,
              birthRate:      state.birthRate2023,
              deathRate:      state.deathRate2023,
              anaemiaPct:     state.anaemiaPct,
              womenAnaemiaPct:state.womenAnaemiaPct,
            }}
          />

          {/* Data sources */}
          <section id="sources" style={{ marginTop: "2rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem", scrollMarginTop: "90px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1rem" }}>📄</span>
              <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Data Sources</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                ["IMR / Vital",    "SRS 2023 (Registrar General of India) · state-level"],
                ["NFHS Metrics",   "NFHS-5 2019–21 · vaccination, nutrition, anaemia, births"],
                ["PHC / CHC",      liveHospitals ? "NHP Rural Health Statistics (live API)" : "NHP 2023 static"],
                ["IDSP",           idspCache?.refreshedAt ? `IDSP surveillance · refreshed ${new Date(idspCache.refreshedAt).toLocaleDateString("en-IN")}` : "IDSP · pending first refresh"],
                ["AI Analysis",    "Groq llama-3.3-70b · on-demand generation"],
              ].map(([m, s]) => (
                <div key={m} style={{ display: "flex", gap: "1rem", fontSize: "0.82rem" }}>
                  <span className="font-data" style={{ color: "#2dd4bf", minWidth: "100px", flexShrink: 0 }}>{m}</span>
                  <span style={{ color: "#64748b" }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid #1e3a5f", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/sources" style={{ color: "#0d9488", textDecoration: "none", fontSize: "0.82rem", fontWeight: 600 }}>View all sources →</Link>
              <Link href="/" style={{ color: "#475569", textDecoration: "none", fontSize: "0.82rem" }}>← All States</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
