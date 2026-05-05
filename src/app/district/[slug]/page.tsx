import { notFound } from "next/navigation";
import Link from "next/link";
import cities from "@/data/cities.json";
import states from "@/data/states.json";
import NearbyHealthCentres from "@/components/NearbyHealthCentres";
import AIAnalysisCard from "@/components/AIAnalysisCard";
import { fetchAQI, fetchGoogleAQI, geocodeCity, fetchHealthCentres } from "@/lib/api";
import { readFile } from "fs/promises";
import path from "path";
import type { OutbreakAlert } from "@/lib/idsp";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const city = cities.find(c => c.slug === params.slug);
  if (!city) return {};
  const stateName = city.stateName ?? "";
  const desc = [
    `${city.name}, ${stateName} public health data:`,
    city.aqi != null ? `AQI ${city.aqi} (${city.aqiLabel ?? ""})` : null,
    "hospital infrastructure, disease outbreaks, vaccination coverage.",
    "Source: CPCB, NFHS-5, IDSP, MoHFW.",
  ].filter(Boolean).join(" ");
  const url = `https://vyasaa.com/district/${city.slug}`;
  return {
    title: `${city.name} Health Data — AQI, Hospitals & Disease Surveillance | ${stateName}`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${city.name} Public Health Dashboard | Vyasa`,
      description: desc,
      url,
      images: [{ url: `/og?title=${encodeURIComponent(city.name + " Health Data")}&sub=${encodeURIComponent(desc)}&state=${encodeURIComponent(stateName)}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: `${city.name} Health Data | Vyasa`, description: desc, images: [`/og?title=${encodeURIComponent(city.name + " Health Data")}&state=${encodeURIComponent(stateName)}`] },
  };
}

async function getIDSPCache() {
  try {
    const raw = await readFile(path.join(process.cwd(), "src/data/idsp-cache.json"), "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}


export default async function DistrictPage({ params }: { params: { slug: string } }) {
  const city = cities.find((c) => c.slug === params.slug);
  if (!city) notFound();

  const stateData = states.find((s) => s.slug === city.stateSlug);

  const coords = await geocodeCity(city.name, city.stateName);
  const [cpcbAQI, googleAQI, liveHospitals, idspCache] = await Promise.all([
    fetchAQI(city.name),
    coords ? fetchGoogleAQI(coords.lat, coords.lng) : Promise.resolve(null),
    stateData ? fetchHealthCentres(stateData.phcStateName) : Promise.resolve(null),
    getIDSPCache(),
  ]);

  const liveAQI  = googleAQI ?? cpcbAQI;
  const aqi      = liveAQI?.aqi ?? city.aqi;
  const aqiLabel = liveAQI?.label ?? city.aqiLabel;
  const aqiSrc   = googleAQI ? "Google AQI" : cpcbAQI ? "CPCB Live" : "Static";

  const imr            = stateData?.imr ?? null;
  const vaccPct        = stateData?.vaccinationPct ?? null;
  const stuntingPct    = stateData?.stuntingPct ?? null;
  const instBirths     = stateData?.institutionalBirthsPct ?? null;
  const anaemia        = stateData?.anaemiaPct ?? null;
  const neonatalMR     = stateData?.neonatalMR ?? null;
  const under5MR       = stateData?.under5MR ?? null;
  const underweightPct = stateData?.underweightPct ?? null;
  const wastingPct     = stateData?.wastingPct ?? null;
  const womenAnaemia   = stateData?.womenAnaemiaPct ?? null;

  function stateNameMatches(field: string, name: string) {
    const fieldLow = field.toLowerCase();
    return name.toLowerCase().split(/\s+/).every(w => fieldLow.includes(w));
  }

  const stateOutbreaks: OutbreakAlert[] = (idspCache?.outbreaks ?? []).filter(
    (a: OutbreakAlert) => stateData && stateNameMatches(a.state, stateData.name)
  );
  const districtOutbreaks: OutbreakAlert[] = stateOutbreaks.filter(
    (a: OutbreakAlert) => a.district && a.district.toLowerCase().includes(city.name.toLowerCase().split(/\s+/)[0])
  );


  const aqiColor = !aqiLabel ? "#94a3b8"
    : aqiLabel === "Good" ? "#22c55e"
    : aqiLabel === "Moderate" ? "#eab308"
    : aqiLabel.includes("Sensitive") ? "#f97316"
    : aqiLabel === "Unhealthy" ? "#ef4444"
    : "#a855f7";

  const aiMetrics = {
    imr, neonatalMR, under5MR,
    vaccPct, stuntingPct, wastingPct, underweightPct,
    instBirths, womenAnaemia, anaemia,
    birthRate: stateData?.birthRate2023,
    deathRate: stateData?.deathRate2023,
    phcTotal:  liveHospitals?.phcTotal,
    chcTotal:  liveHospitals?.chcTotal,
    aqi, aqiLabel,
  };

  const districtUrl = `https://vyasaa.com/district/${city.slug}`;

  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": `${city.name} Public Health Statistics`,
        "description": `Health data for ${city.name}, ${city.stateName ?? ""}: IMR, vaccination, AQI, hospital infrastructure and PMJAY coverage.`,
        "url": districtUrl,
        "creator": { "@type": "Organization", "name": "Vyasa Health" },
        "spatialCoverage": {
          "@type": "City",
          "name": city.name,
          "containedInPlace": { "@type": "State", "name": city.stateName ?? "", "containedInPlace": { "@type": "Country", "name": "India" } },
        },
        "variableMeasured": [
          ...(city.aqi != null ? [{ "@type": "PropertyValue", "name": "Air Quality Index", "value": city.aqi }] : []),
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "India", "item": "https://www.vyasaa.com" },
          ...(stateData ? [{ "@type": "ListItem", "position": 2, "name": stateData.name, "item": `https://vyasaa.com/state/${stateData.slug}` }] : []),
          { "@type": "ListItem", "position": stateData ? 3 : 2, "name": city.name, "item": districtUrl },
        ],
      }} />

      {/* ── BREADCRUMB BAR ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", gap: "0.4rem", height: "38px", fontSize: "0.78rem", color: "#475569" }}>
          <Link href="/" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 500 }}>India</Link>
          <span>›</span>
          {stateData && (
            <>
              <Link href={`/state/${stateData.slug}`} style={{ color: "#0d9488", textDecoration: "none", fontWeight: 500 }}>{stateData.name}</Link>
              <span>›</span>
            </>
          )}
          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{city.name}</span>
          <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#334155" }}>
            {liveAQI && <span style={{ color: "#2dd4bf" }}>● Live AQI  </span>}SRS 2023 · NFHS-5
          </span>
        </div>
      </div>

      {/* ── DISTRICT HEADER ──────────────────────────────────────────── */}
      <div id="overview" style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "1.75rem 1.5rem 0", scrollMarginTop: "64px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "0.2rem" }}>
                {city.name}
              </h1>
              <p style={{ fontSize: "0.8rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {city.stateName} · City Health Dashboard
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.6rem" }}>
                {liveAQI && <span style={{ fontSize: "0.62rem", color: "#f97316", backgroundColor: "#f9731618", border: "1px solid #f9731640", borderRadius: "4px", padding: "0.12rem 0.45rem", fontFamily: "monospace" }}>{aqiSrc} · AQI {aqi}</span>}
                {stateData && <span style={{ fontSize: "0.62rem", color: "#6366f1", backgroundColor: "#6366f118", border: "1px solid #6366f140", borderRadius: "4px", padding: "0.12rem 0.45rem", fontFamily: "monospace" }}>NFHS-5 (state)</span>}
                {liveHospitals && <span style={{ fontSize: "0.62rem", color: "#2dd4bf", backgroundColor: "#2dd4bf18", border: "1px solid #2dd4bf40", borderRadius: "4px", padding: "0.12rem 0.45rem", fontFamily: "monospace" }}>NHP Live</span>}
              </div>
            </div>
            {/* AQI badge */}
            {liveAQI && (
              <div style={{ backgroundColor: `${aqiColor}18`, border: `1px solid ${aqiColor}50`, borderRadius: "12px", padding: "1rem 1.5rem", textAlign: "center", minWidth: "100px" }}>
                <div className="font-data" style={{ fontSize: "2rem", fontWeight: 700, color: aqiColor, lineHeight: 1 }}>{aqi}</div>
                <div style={{ fontSize: "0.68rem", color: aqiColor, marginTop: "0.2rem" }}>AQI</div>
                <div style={{ fontSize: "0.6rem", color: "#475569" }}>{aqiLabel}</div>
              </div>
            )}
          </div>

          {/* Key stats bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0", borderTop: "1px solid #1e3a5f" }}>
            {[
              { label: "IMR (state)", value: imr != null ? `${imr}` : "—",               unit: "/1k LB",    color: imr != null && imr <= 20 ? "#22c55e" : "#f97316" },
              { label: "Vaccination", value: vaccPct != null ? `${vaccPct}%` : "—",       unit: "full cover",color: "#2dd4bf" },
              { label: "Stunting",    value: stuntingPct != null ? `${stuntingPct}%` : "—", unit: "u-5 children", color: "#eab308" },
              { label: "PHCs",        value: liveHospitals ? String(liveHospitals.phcTotal) : "—", unit: "state-level", color: "#94a3b8" },
              { label: "AQI",         value: aqi != null ? String(aqi) : "—",             unit: aqiLabel ?? "", color: aqiColor },
              { label: "CPCB Stns",   value: String(city.stations),                       unit: "monitoring", color: "#64748b" },
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
            <AIAnalysisCard name={city.name} level="district" metrics={aiMetrics} />
          </div>

          {/* District-specific IDSP outbreaks */}
          {districtOutbreaks.length > 0 && (
            <div id="disease" style={{ backgroundColor: "#071428", border: "1px solid #ef444440", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.25rem", scrollMarginTop: "90px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                <span>🦠</span>
                <h2 className="font-display" style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fca5a5", margin: 0 }}>
                  Disease Surveillance · {city.name}
                </h2>
                <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#64748b", background: "#0a1628", borderRadius: "4px", padding: "0.1rem 0.4rem", border: "1px solid #1e3a5f" }}>IDSP</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {districtOutbreaks.map((o, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "#060e1c", borderRadius: "8px", padding: "0.6rem 0.85rem", borderLeft: "3px solid #ef444460" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fca5a5" }}>{o.disease}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>{o.district}, {o.state}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fca5a5" }}>{o.cases} cases</div>
                      {o.deaths > 0 && <div style={{ fontSize: "0.7rem", color: "#ef4444" }}>{o.deaths} deaths</div>}
                      <div style={{ fontSize: "0.62rem", color: o.status === "active" ? "#fbbf24" : "#22c55e", marginTop: "0.1rem", textTransform: "capitalize" }}>{o.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Air Quality — district-specific */}
          {aqi != null && (
            <section id="environment" style={{ marginBottom: "1.25rem", scrollMarginTop: "90px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1rem" }}>🌫️</span>
                <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Air Quality · {city.name}</h2>
                <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>{aqiSrc}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.85rem" }}>
                <div style={{ backgroundColor: `${aqiColor}18`, border: `1px solid ${aqiColor}40`, borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Air Quality Index</div>
                  <div className="font-data" style={{ fontSize: "2rem", fontWeight: 700, color: aqiColor, lineHeight: 1 }}>{aqi}</div>
                  <div style={{ fontSize: "0.72rem", color: aqiColor, backgroundColor: `${aqiColor}20`, borderRadius: "4px", display: "inline-block", padding: "0.1rem 0.5rem", marginTop: "0.35rem" }}>{aqiLabel}</div>
                </div>
                {googleAQI?.pollutants && Object.entries(googleAQI.pollutants).slice(0, 5).map(([key, val]) => (
                  <div key={key} style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>{key}</div>
                    <div className="font-data" style={{ fontSize: "1.5rem", fontWeight: 600, color: "#e2e8f0", lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: "0.68rem", color: "#475569", marginTop: "0.25rem" }}>µg/m³ · {aqiSrc}</div>
                  </div>
                ))}
              </div>
              {googleAQI?.healthRecommendation && (
                <div style={{ marginTop: "0.85rem", backgroundColor: `${aqiColor}10`, border: `1px solid ${aqiColor}30`, borderRadius: "8px", padding: "0.85rem 1.25rem", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6 }}>
                  <span style={{ color: aqiColor, fontWeight: 600, marginRight: "0.5rem" }}>Health Advisory:</span>
                  {googleAQI.healthRecommendation}
                </div>
              )}
            </section>
          )}

          {/* State health stats — link to full dashboard */}
          {stateData && (
            <Link href={`/state/${stateData.slug}`} style={{ textDecoration: "none", display: "block", marginBottom: "1.25rem" }}>
              <div style={{ backgroundColor: "#071428", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem" }}>State Health Statistics</div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#e2e8f0" }}>
                    IMR {imr ?? "—"} · Vaccination {vaccPct != null ? `${vaccPct}%` : "—"} · Stunting {stuntingPct != null ? `${stuntingPct}%` : "—"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.2rem" }}>
                    Full NFHS-5 · SRS 2023 · AB-PMJAY data for {stateData.name}
                  </div>
                </div>
                <span style={{ color: "#0d9488", fontSize: "0.85rem", fontWeight: 600, flexShrink: 0 }}>View full dashboard →</span>
              </div>
            </Link>
          )}

          {/* Nearby facilities */}
          <div id="facilities" style={{ scrollMarginTop: "90px", marginTop: "2rem" }}>
            <NearbyHealthCentres stateName={city.stateName} defaultCity={city.name} />
          </div>


          {/* Data sources */}
          <section id="sources" style={{ marginTop: "2rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem", scrollMarginTop: "90px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1rem" }}>📄</span>
              <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Data Sources</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                ["AQI",       liveAQI ? `${aqiSrc} · ${liveAQI.stationCount} station(s) · ${liveAQI.lastUpdate}` : "CPCB static"],
                ["IMR/Mort",  "SRS 2023 (RGI) · state-level"],
                ["NFHS",      "NFHS-5 2019–21 · vaccination, stunting, anaemia"],
                ["PHC/CHC",   liveHospitals ? "NHP Rural Health Statistics (live API)" : "NHP 2023 static"],
                ["IDSP",      idspCache?.refreshedAt ? `IDSP surveillance · refreshed ${new Date(idspCache.refreshedAt).toLocaleDateString("en-IN")}` : "IDSP · pending refresh"],
                ["AI",        "Groq llama-3.3-70b · on-demand generation"],
              ].map(([m, s]) => (
                <div key={m} style={{ display: "flex", gap: "1rem", fontSize: "0.82rem" }}>
                  <span className="font-data" style={{ color: "#2dd4bf", minWidth: "80px", flexShrink: 0 }}>{m}</span>
                  <span style={{ color: "#64748b" }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid #1e3a5f", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/sources" style={{ color: "#0d9488", textDecoration: "none", fontSize: "0.82rem", fontWeight: 600 }}>All sources →</Link>
              {stateData && <Link href={`/state/${stateData.slug}`} style={{ color: "#475569", textDecoration: "none", fontSize: "0.82rem" }}>← {stateData.name} State</Link>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
