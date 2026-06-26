import type { OutbreakAlert, IDSPRecord } from "@/lib/idsp";

interface Props {
  // I. Mortality
  imr?:            number | null;
  imrSRS2023?:     number | null;
  imrNFHS5?:       number | null;
  imrRural?:       number | null;
  imrUrban?:       number | null;
  neonatalMR?:     number | null;
  under5MR?:       number | null;
  birthRate?:      number | null;
  deathRate?:      number | null;

  // II. Morbidity / IDSP
  outbreaks?:      OutbreakAlert[];
  diseaseRecords?: IDSPRecord[];
  anaemiaPct?:     number | null;
  womenAnaemiaPct?:number | null;

  // III. Vaccination
  vaccinationPct?: number | null;

  // IV. Nutrition
  stuntingPct?:    number | null;
  wastingPct?:     number | null;
  underweightPct?: number | null;

  // V. Infrastructure
  phcTotal?:       number;
  chcTotal?:       number;
  hospitalBeds?:   number;

  // VI. Environment
  aqi?:            number;
  aqiLabel?:       string;
  pollutants?:     Record<string, number>;
  healthRec?:      string;
  aqiSource?:      string;

  // meta
  instBirthsPct?:  number | null;
  stateName?:      string;
  level?:          "state" | "district";
  idspWeekLabel?:  string;
}

function scoreColor(v: number, best: number, worst: number, higher: boolean) {
  const good = higher ? v >= best : v <= best;
  const bad  = higher ? v <= worst : v >= worst;
  return good ? "#22c55e" : bad ? "#ef4444" : "#eab308";
}
function scoreBg(v: number, best: number, worst: number, higher: boolean) {
  const c = scoreColor(v, best, worst, higher);
  return c + "18";
}
function scoreLabel(v: number, best: number, worst: number, higher: boolean) {
  const good = higher ? v >= best : v <= best;
  const bad  = higher ? v <= worst : v >= worst;
  return good ? "Good" : bad ? "Needs Attention" : "Average";
}

function MetricCard({
  label, value, unit = "", sub, best, worst, higher = false, srcBadge,
}: {
  label: string; value: string | number; unit?: string; sub?: string;
  best?: number; worst?: number; higher?: boolean; srcBadge?: string;
}) {
  const num = typeof value === "number" ? value : parseFloat(value);
  const hasScore = best !== undefined && worst !== undefined && !isNaN(num);
  const col  = hasScore ? scoreColor(num, best!, worst!, higher) : "#e2e8f0";
  const bg   = hasScore ? scoreBg(num, best!, worst!, higher) : "#0f204088";
  const lbl  = hasScore ? scoreLabel(num, best!, worst!, higher) : null;

  return (
    <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
      <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{label}</span>
        {srcBadge && <span style={{ color: "#334155", fontSize: "0.6rem", fontFamily: "'IBM Plex Mono', monospace" }}>{srcBadge}</span>}
      </div>
      <div className="font-data" style={{ fontSize: "1.6rem", fontWeight: 600, color: col, marginBottom: "0.1rem" }}>
        {value}{unit && <span style={{ fontSize: "0.85rem", color: "#64748b" }}> {unit}</span>}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "#475569", lineHeight: 1.4 }}>{sub}</div>}
      {lbl && (
        <div style={{ marginTop: "0.5rem", display: "inline-block", fontSize: "0.62rem", color: col, backgroundColor: bg, borderRadius: "4px", padding: "0.1rem 0.5rem", fontWeight: 600 }}>{lbl}</div>
      )}
    </div>
  );
}

function CategoryHeader({ roman, title, icon, count }: { roman: string; title: string; icon: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
      <div style={{ width: "36px", height: "36px", backgroundColor: "#0d948820", border: "1px solid #0d948840", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "0.6rem", color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "0.1rem" }}>
          {roman}
        </div>
        <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem" }}>{title}</div>
      </div>
      {count !== undefined && (
        <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#334155" }}>{count} indicators</span>
      )}
    </div>
  );
}

function OutbreakCard({ alert }: { alert: OutbreakAlert }) {
  const statusColor = alert.status === "active" ? "#ef4444" : alert.status === "contained" ? "#22c55e" : "#eab308";
  return (
    <div style={{ backgroundColor: "#0f2040", border: `1px solid ${statusColor}30`, borderRadius: "8px", padding: "0.85rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.3rem" }}>
        <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.82rem" }}>{alert.disease}</span>
        <span style={{ fontSize: "0.6rem", color: statusColor, backgroundColor: `${statusColor}18`, borderRadius: "4px", padding: "0.1rem 0.45rem", textTransform: "capitalize", flexShrink: 0 }}>{alert.status}</span>
      </div>
      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{alert.state}{alert.district ? ` · ${alert.district}` : ""}</div>
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.4rem", fontSize: "0.7rem" }}>
        {alert.cases > 0 && <span style={{ color: "#eab308" }}>Cases: {alert.cases.toLocaleString()}</span>}
        {alert.deaths > 0 && <span style={{ color: "#ef4444" }}>Deaths: {alert.deaths}</span>}
        <span style={{ color: "#334155", marginLeft: "auto" }}>{alert.reportDate}</span>
      </div>
    </div>
  );
}

export default function HealthCategories({
  imr, imrSRS2023, imrNFHS5, imrRural, imrUrban,
  neonatalMR, under5MR, birthRate, deathRate,
  outbreaks = [], diseaseRecords = [], anaemiaPct, womenAnaemiaPct,
  vaccinationPct, instBirthsPct,
  stuntingPct, wastingPct, underweightPct,
  phcTotal, chcTotal, hospitalBeds,
  aqi, aqiLabel, pollutants, healthRec, aqiSource,
  stateName, level = "state", idspWeekLabel,
}: Props) {

  const primaryIMR = imrSRS2023 ?? imr;
  const allOutbreaks = outbreaks;
  const hasInfrastructure = phcTotal || chcTotal || hospitalBeds;
  const hasNutrition = stuntingPct != null || wastingPct != null || underweightPct != null;
  const hasVaccination = vaccinationPct != null;
  const hasMorbidity = anaemiaPct != null || allOutbreaks.length > 0 || diseaseRecords.length > 0;
  const hasEnvironment = aqi != null;

  const aqiColor = !aqiLabel ? "#94a3b8"
    : aqiLabel === "Good"    ? "#22c55e"
    : aqiLabel === "Moderate"? "#eab308"
    : aqiLabel.includes("Sensitive") ? "#f97316"
    : aqiLabel === "Unhealthy" ? "#ef4444"
    : "#a855f7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── I. MORTALITY ─────────────────────────────────────────────────── */}
      <section id="mortality" style={{ scrollMarginTop: "90px" }}>
        <CategoryHeader roman="I" title="Mortality Indicators" icon="📉" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
          {primaryIMR != null && (
            <MetricCard label="Infant Mortality Rate" value={primaryIMR} unit="/1000 LB" sub="SRS 2023 (RGI)" best={15} worst={35} srcBadge="SRS 2023" />
          )}
          {imrNFHS5 != null && (
            <MetricCard label="IMR (NFHS-5 Survey)" value={imrNFHS5} unit="/1000 LB" sub="NFHS-5 2019-21 survey estimate" best={20} worst={40} srcBadge="NFHS-5" />
          )}
          {imrRural != null && <MetricCard label="IMR Rural" value={imrRural} unit="/1000 LB" sub="SRS 2023 rural estimate" best={18} worst={40} srcBadge="SRS 2023" />}
          {imrUrban != null && <MetricCard label="IMR Urban" value={imrUrban} unit="/1000 LB" sub="SRS 2023 urban estimate" best={12} worst={28} srcBadge="SRS 2023" />}
          {neonatalMR != null && <MetricCard label="Neonatal Mortality" value={neonatalMR} unit="/1000 LB" sub="Deaths in first 28 days" best={15} worst={30} srcBadge="NFHS-5" />}
          {under5MR != null && <MetricCard label="Under-5 Mortality" value={under5MR} unit="/1000 LB" sub="Deaths before age 5" best={25} worst={50} srcBadge="NFHS-5" />}
          {birthRate != null && <MetricCard label="Birth Rate" value={birthRate} unit="/1000 pop" sub="SRS 2023" best={13} worst={22} srcBadge="SRS 2023" />}
          {deathRate != null && <MetricCard label="Death Rate" value={deathRate} unit="/1000 pop" sub="SRS 2023" best={5} worst={8} srcBadge="SRS 2023" />}
        </div>
      </section>

      {/* ── II. MORBIDITY & INFECTIOUS DISEASE ──────────────────────────── */}
      {hasMorbidity && (
        <section id="disease" style={{ scrollMarginTop: "90px" }}>
          <CategoryHeader roman="II" title="Morbidity & Infectious Disease" icon="🦠" />

          {allOutbreaks.length > 0 ? (
            <div style={{ marginBottom: "1rem" }}>
              {/* IDSP weekly summary header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.65rem", backgroundColor: "#ef444420", color: "#ef4444", borderRadius: "4px", padding: "0.15rem 0.5rem", fontWeight: 600 }}>LIVE</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {idspWeekLabel ?? "IDSP Surveillance"} · {allOutbreaks.length} outbreak{allOutbreaks.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.72rem" }}>
                  <span style={{ color: "#eab308" }}>Cases: <strong style={{ color: "#fbbf24" }}>{allOutbreaks.reduce((s, a) => s + (a.cases || 0), 0).toLocaleString()}</strong></span>
                  <span style={{ color: "#ef4444" }}>Deaths: <strong style={{ color: "#f87171" }}>{allOutbreaks.reduce((s, a) => s + (a.deaths || 0), 0)}</strong></span>
                </div>
              </div>
              {/* District-level outbreak table */}
              <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 55px", gap: 0, borderBottom: "1px solid #1e3a5f", padding: "0.45rem 1rem", backgroundColor: "#0d1f3c" }}>
                  <span style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>District</span>
                  <span style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Disease</span>
                  <span style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "right" }}>Cases</span>
                  <span style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "right" }}>Deaths</span>
                </div>
                {allOutbreaks.map((a, i) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 55px", gap: 0, padding: "0.55rem 1rem", borderBottom: i < allOutbreaks.length - 1 ? "1px solid #0f2040" : "none", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "0.78rem", color: "#e2e8f0", fontWeight: 500 }}>{a.district || "—"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{a.disease}</span>
                      {a.status === "active" && <span style={{ fontSize: "0.55rem", backgroundColor: "#ef444420", color: "#ef4444", borderRadius: "3px", padding: "0.05rem 0.3rem" }}>active</span>}
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "#fbbf24", fontWeight: 600, textAlign: "right" }}>{(a.cases || 0).toLocaleString()}</span>
                    <span style={{ fontSize: "0.82rem", color: a.deaths > 0 ? "#f87171" : "#334155", fontWeight: a.deaths > 0 ? 600 : 400, textAlign: "right" }}>{a.deaths || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#0f2040", border: "1px solid #22c55e30", borderRadius: "8px", padding: "0.85rem 1.25rem", fontSize: "0.82rem", color: "#22c55e", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span>✓</span> No active IDSP outbreak alerts {stateName ? `for ${stateName}` : ""}. Data updated every 48 hours.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
            {anaemiaPct != null && <MetricCard label="Child Anaemia" value={`${anaemiaPct}%`} sub="Children age 6–59 months · NFHS-5" best={40} worst={70} srcBadge="NFHS-5" />}
            {womenAnaemiaPct != null && <MetricCard label="Women Anaemia" value={`${womenAnaemiaPct}%`} sub="Women age 15–49 years · NFHS-5" best={30} worst={55} srcBadge="NFHS-5" />}
            {diseaseRecords.length > 0 && (
              <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.1rem 1.25rem", gridColumn: "span 1" }}>
                <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>IDSP Disease Burden</div>
                <div className="font-data" style={{ fontSize: "1.6rem", fontWeight: 600, color: "#eab308" }}>{diseaseRecords.length}</div>
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>disease surveillance records</div>
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {[...new Set(diseaseRecords.map(r => r.disease))].slice(0, 5).map(d => (
                    <span key={d} style={{ fontSize: "0.6rem", backgroundColor: "#1e3a5f40", borderRadius: "3px", padding: "0.1rem 0.35rem", color: "#64748b" }}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── III. VACCINATION ────────────────────────────────────────────── */}
      {hasVaccination && (
        <section id="vaccination" style={{ scrollMarginTop: "90px" }}>
          <CategoryHeader roman="III" title="Vaccination Coverage" icon="💉" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
            <MetricCard label="Full Immunization" value={`${vaccinationPct}%`} sub="Children fully immunized 12–23 months" best={85} worst={60} higher srcBadge="NFHS-6" />
            {instBirthsPct != null && <MetricCard label="Institutional Births" value={`${instBirthsPct}%`} sub="Delivered in health facility" best={90} worst={70} higher srcBadge="NFHS-6" />}
          </div>
          {vaccinationPct != null && (
            <div style={{ marginTop: "0.85rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.85rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Coverage</span>
                <span className="font-data" style={{ fontSize: "0.82rem", color: vaccinationPct >= 85 ? "#22c55e" : vaccinationPct >= 60 ? "#eab308" : "#ef4444" }}>{vaccinationPct}%</span>
              </div>
              <div style={{ height: "8px", backgroundColor: "#1e3a5f", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(vaccinationPct, 100)}%`, backgroundColor: vaccinationPct >= 85 ? "#22c55e" : vaccinationPct >= 60 ? "#eab308" : "#ef4444", borderRadius: "4px", transition: "width 0.5s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.6rem", color: "#334155" }}>
                <span>0%</span><span>WHO target: 90%</span><span>100%</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── IV. NUTRITIONAL STATUS ───────────────────────────────────────── */}
      {hasNutrition && (
        <section id="nutrition" style={{ scrollMarginTop: "90px" }}>
          <CategoryHeader roman="IV" title="Nutritional Status" icon="🥗" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
            {stuntingPct != null && <MetricCard label="Child Stunting" value={`${stuntingPct}%`} sub="Height-for-age below -2 SD (under 5)" best={20} worst={40} srcBadge="NFHS-6" />}
            {wastingPct != null && <MetricCard label="Child Wasting" value={`${wastingPct}%`} sub="Acute malnutrition under 5" best={10} worst={20} srcBadge="NFHS-6" />}
            {underweightPct != null && <MetricCard label="Child Underweight" value={`${underweightPct}%`} sub="Weight-for-age below -2 SD" best={20} worst={40} srcBadge="NFHS-6" />}
          </div>
        </section>
      )}

      {/* ── V. HEALTHCARE INFRASTRUCTURE ────────────────────────────────── */}
      {hasInfrastructure && (
        <section id="infrastructure" style={{ scrollMarginTop: "90px" }}>
          <CategoryHeader roman="V" title="Healthcare Infrastructure & Resources" icon="🏥" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
            {phcTotal != null && phcTotal > 0 && (
              <MetricCard label="Primary Health Centres" value={phcTotal.toLocaleString()} sub="Govt PHCs · NHP RHS 2020-21" srcBadge="NHP live" />
            )}
            {chcTotal != null && chcTotal > 0 && (
              <MetricCard label="Community Health Centres" value={chcTotal.toLocaleString()} sub="Govt CHCs · NHP RHS 2020-21" srcBadge="NHP live" />
            )}
            {hospitalBeds != null && hospitalBeds > 0 && (
              <MetricCard label="Hospital Beds" value={hospitalBeds.toLocaleString()} sub="Total registered beds" srcBadge="data.gov.in" />
            )}
            {phcTotal && chcTotal && (
              <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Total Govt Facilities</div>
                <div className="font-data" style={{ fontSize: "1.6rem", fontWeight: 600, color: "#2dd4bf" }}>
                  {(phcTotal + chcTotal).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>PHCs + CHCs combined</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── VI. ENVIRONMENTAL HEALTH ─────────────────────────────────────── */}
      {hasEnvironment && aqi != null && (
        <section id="environment" style={{ scrollMarginTop: "90px" }}>
          <CategoryHeader roman="VI" title="Environmental Health" icon="🌫" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.85rem" }}>
            {/* AQI main card */}
            <div style={{ backgroundColor: "#0f2040", border: `1px solid ${aqiColor}40`, borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Air Quality Index</span>
                {aqiSource && <span style={{ fontSize: "0.6rem", color: "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>{aqiSource}</span>}
              </div>
              <div className="font-data" style={{ fontSize: "1.6rem", fontWeight: 600, color: aqiColor }}>{aqi}</div>
              <div style={{ fontSize: "0.72rem", color: aqiColor, backgroundColor: `${aqiColor}20`, borderRadius: "4px", display: "inline-block", padding: "0.1rem 0.5rem", marginTop: "0.2rem" }}>{aqiLabel}</div>
            </div>

            {/* Pollutant breakdown */}
            {pollutants && Object.keys(pollutants).length > 0 && Object.entries(pollutants).slice(0, 6).map(([key, val]) => (
              <MetricCard key={key} label={key.toUpperCase()} value={val} unit="µg/m³" sub={`Pollutant concentration · ${aqiSource ?? "Google AQI"}`} />
            ))}
          </div>

          {/* Health recommendation */}
          {healthRec && (
            <div style={{ marginTop: "0.85rem", backgroundColor: `${aqiColor}10`, border: `1px solid ${aqiColor}30`, borderRadius: "8px", padding: "0.85rem 1.25rem", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6 }}>
              <span style={{ color: aqiColor, fontWeight: 600, marginRight: "0.5rem" }}>Health Advisory:</span>
              {healthRec}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
