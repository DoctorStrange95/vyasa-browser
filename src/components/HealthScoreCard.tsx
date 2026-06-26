interface Props {
  imr: number;
  vaccinationPct: number;
  doctorsPer1000: number;
  aqi: number;
  malnutritionPct: number;
  instBirthsPct?: number;
  neonatalMR?: number | null;
  womenAnaemiaPct?: number | null;
}

function score(value: number, best: number, worst: number, higherBetter: boolean): number {
  const lo = Math.min(best, worst);
  const hi = Math.max(best, worst);
  const clamped = Math.max(lo, Math.min(hi, value));
  const pct = higherBetter
    ? (clamped - lo) / (hi - lo)
    : 1 - (clamped - lo) / (hi - lo);
  return Math.round(pct * 100);
}

function color(s: number) {
  if (s >= 70) return "#22c55e";
  if (s >= 45) return "#eab308";
  return "#ef4444";
}

export default function HealthScoreCard({
  imr, vaccinationPct, doctorsPer1000, aqi, malnutritionPct,
  instBirthsPct, neonatalMR, womenAnaemiaPct,
}: Props) {
  const dimensions: Array<{ label: string; s: number; note: string }> = [
    { label: "Child Mortality",    s: score(imr, 10, 60, false),             note: `IMR ${imr}/1000 LB` },
    { label: "Vaccination",        s: score(vaccinationPct, 95, 50, true),   note: `${vaccinationPct}% immunized` },
    { label: "Air Quality",        s: score(aqi, 50, 300, false),            note: `AQI ${aqi} PM2.5` },
    { label: "Nutrition",          s: score(malnutritionPct, 5, 45, false),  note: `${malnutritionPct}% stunted` },
    { label: "Healthcare Access",  s: score(doctorsPer1000, 3, 0.5, true),   note: `${doctorsPer1000} doctors/1000` },
  ];

  if (instBirthsPct !== undefined) {
    dimensions.push({ label: "Facility Births", s: score(instBirthsPct, 98, 60, true), note: `${instBirthsPct}% inst. births` });
  }
  if (neonatalMR !== null && neonatalMR !== undefined) {
    dimensions.push({ label: "Neonatal Survival", s: score(neonatalMR, 10, 35, false), note: `NMR ${neonatalMR}/1000 LB` });
  }
  if (womenAnaemiaPct !== null && womenAnaemiaPct !== undefined) {
    dimensions.push({ label: "Women's Health", s: score(womenAnaemiaPct, 25, 65, false), note: `${womenAnaemiaPct}% anaemia` });
  }

  const overall = Math.round(dimensions.reduce((a, d) => a + d.s, 0) / dimensions.length);

  return (
    <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem", marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Composite Health Score</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>{dimensions.length} dimensions · NFHS-6 + CPCB</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="font-data" style={{ fontSize: "2.5rem", fontWeight: 700, color: color(overall), lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: "0.7rem", color: color(overall), textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {overall >= 70 ? "Good" : overall >= 45 ? "Average" : "Needs Attention"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "0.75rem" }}>
        {dimensions.map(({ label, s, note }) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{label}</span>
              <span className="font-data" style={{ fontSize: "0.78rem", color: color(s) }}>{s}</span>
            </div>
            <div style={{ height: "4px", backgroundColor: "#1e3a5f", borderRadius: "2px", marginBottom: "0.2rem" }}>
              <div style={{ height: "100%", width: `${s}%`, backgroundColor: color(s), borderRadius: "2px", transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: "0.65rem", color: "#475569" }}>{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
