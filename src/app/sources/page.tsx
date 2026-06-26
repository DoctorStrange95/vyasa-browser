export default function SourcesPage() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "3rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "#0d948820",
            border: "1px solid #0d948840",
            borderRadius: "20px",
            padding: "0.3rem 0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#2dd4bf", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
            Methodology
          </span>
        </div>
        <h1
          className="font-display"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}
        >
          Data Sources
        </h1>
        <p style={{ fontSize: "1rem", color: "#94a3b8", lineHeight: 1.75, maxWidth: "600px" }}>
          All data on Vyasa is sourced from official Indian government
          databases and peer-reviewed public health datasets. Below is a full
          accounting of every data source, its update frequency, and how we
          use it.
        </p>
      </div>

      {/* Sources list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {SOURCES.map((s) => (
          <SourceCard key={s.id} source={s} />
        ))}
      </div>

      {/* Disclaimer */}
      <div
        style={{
          marginTop: "3rem",
          backgroundColor: "#0f2040",
          border: "1px solid #1e3a5f",
          borderRadius: "12px",
          padding: "1.5rem 2rem",
        }}
      >
        <h3 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.75rem" }}>
          Disclaimer
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.75 }}>
          Data presented on Vyasa is aggregated from public government sources
          for informational and transparency purposes only. While we strive for accuracy,
          there may be discrepancies due to reporting delays, methodology changes, or
          boundary revisions. This platform does not constitute medical advice. For
          clinical decisions, consult official government health portals or your healthcare
          provider.
        </p>
        <p style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.75rem" }}>
          The data shown is representative of years 2021–2023 depending on availability.
          NFHS-5 data covers 2019–21. AQI data is updated annually. See our full{" "}
          <a href="/nfhs-6" style={{ color: "#2dd4bf", textDecoration: "underline" }}>
            NFHS-6 (2023-24) key-indicator analysis and NFHS-5 comparison
          </a>.
        </p>
      </div>
    </div>
  );
}

interface Source {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  metrics: string[];
  updateFrequency: string;
  coverage: string;
  color: string;
}

const SOURCES: Source[] = [
  {
    id: "NHP",
    name: "NHP",
    fullName: "National Health Profile",
    url: "https://nhp.gov.in",
    description:
      "The NHP is published annually by the Central Bureau of Health Intelligence (CBHI) under MoHFW. It consolidates health infrastructure, human resources, disease burden, and health financing data from all states.",
    metrics: ["Hospitals", "Doctors per 1,000", "Beds per 1,000", "Health workforce"],
    updateFrequency: "Annual",
    coverage: "All 36 states & UTs",
    color: "#0d9488",
  },
  {
    id: "NFHS",
    name: "NFHS-5",
    fullName: "National Family Health Survey – 5",
    url: "https://nfhs.iipsindia.ac.in",
    description:
      "NFHS-5 (2019–21) is conducted by the International Institute for Population Sciences under MoHFW. It is the most comprehensive source for maternal and child health indicators including IMR, vaccination, nutrition, and fertility.",
    metrics: ["Infant Mortality Rate (IMR)", "Vaccination Coverage", "Malnutrition %", "Institutional Births", "Maternal Mortality Ratio"],
    updateFrequency: "Every ~5 years (NFHS-6 expected 2028)",
    coverage: "District-level for all 707 districts",
    color: "#6366f1",
  },
  {
    id: "IDSP",
    name: "IDSP",
    fullName: "Integrated Disease Surveillance Programme",
    url: "https://idsp.nic.in",
    description:
      "IDSP monitors disease outbreaks and provides weekly epidemiological data across India. Operated by the National Centre for Disease Control (NCDC), it is the primary source for outbreak detection and communicable disease trends.",
    metrics: ["Disease outbreaks", "Epidemic alerts", "Communicable disease burden"],
    updateFrequency: "Weekly",
    coverage: "District and state level",
    color: "#f59e0b",
  },
  {
    id: "PMJAY",
    name: "PMJAY",
    fullName: "Pradhan Mantri Jan Arogya Yojana",
    url: "https://pmjay.gov.in",
    description:
      "Administered by the National Health Authority (NHA), PMJAY is the world's largest government-funded health assurance scheme covering 500M+ individuals. Enrollment and hospital empanelment data is published monthly.",
    metrics: ["Beneficiary enrollment", "Hospital claims", "Empaneled hospitals", "Disease-wise hospitalizations"],
    updateFrequency: "Monthly",
    coverage: "33 states & UTs participating",
    color: "#22c55e",
  },
  {
    id: "eRaktKosh",
    name: "eRaktKosh",
    fullName: "eRaktKosh Blood Bank Management",
    url: "https://eraktkosh.mohfw.gov.in",
    description:
      "eRaktKosh is the national blood bank management information system managed by MoHFW. It provides real-time data on blood bank locations, blood availability, and component-wise stock across India.",
    metrics: ["Blood bank count", "Blood availability", "Component stock levels"],
    updateFrequency: "Real-time",
    coverage: "3,800+ blood banks nationwide",
    color: "#ef4444",
  },
  {
    id: "CPCB",
    name: "CPCB",
    fullName: "Central Pollution Control Board – Air Quality Index",
    url: "https://cpcb.nic.in",
    description:
      "CPCB publishes the National Air Quality Index (AQI) based on readings from continuous ambient air quality monitoring stations (CAAQMS) across 300+ cities. Data includes PM2.5, PM10, NO₂, SO₂, CO, and ozone levels.",
    metrics: ["AQI (PM2.5, PM10)", "NO₂, SO₂, CO, O₃", "City-wise air quality rankings"],
    updateFrequency: "Daily (real-time hourly online)",
    coverage: "300+ cities, 900+ monitoring stations",
    color: "#8b5cf6",
  },
];

function SourceCard({ source }: { source: Source }) {
  return (
    <div
      style={{
        backgroundColor: "#0f2040",
        border: "1px solid #1e3a5f",
        borderRadius: "12px",
        padding: "2rem",
        borderLeft: `4px solid ${source.color}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <span
              className="font-data"
              style={{
                backgroundColor: `${source.color}22`,
                color: source.color,
                padding: "0.2rem 0.6rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {source.id}
            </span>
            <h3 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
              {source.fullName}
            </h3>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.78rem", color: "#0d9488", textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {source.url} ↗
          </a>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge label="Updated" value={source.updateFrequency} />
          <Badge label="Coverage" value={source.coverage} />
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.875rem", color: "#94a3b8", lineHeight: 1.75, marginBottom: "1.25rem" }}>
        {source.description}
      </p>

      {/* Metrics */}
      <div>
        <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
          Metrics used on this platform
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {source.metrics.map((m) => (
            <span
              key={m}
              style={{
                backgroundColor: "#0a1628",
                border: "1px solid #1e3a5f",
                color: "#94a3b8",
                padding: "0.2rem 0.65rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: "#0a1628",
        border: "1px solid #1e3a5f",
        borderRadius: "8px",
        padding: "0.4rem 0.75rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "0.62rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.1rem" }}>{value}</div>
    </div>
  );
}
