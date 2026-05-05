import ContributeForm from "@/components/ContributeForm";
import VyasaLogo from "@/components/VyasaLogo";
import Link from "next/link";

export const metadata = { title: "Contribute Data — Vyasa" };

export default function ContributePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e" }}>
      {/* Top bar */}
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 2rem", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <VyasaLogo size={28} />
          <span className="font-display" style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Vyasa</span>
        </Link>
        <Link href="/" style={{ fontSize: "0.75rem", color: "#475569", textDecoration: "none" }}>← Back to map</Link>
      </div>

      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#0d948815", border: "1px solid #0d948840", borderRadius: "6px", padding: "0.25rem 0.75rem", marginBottom: "1rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#2dd4bf", boxShadow: "0 0 5px #2dd4bf", display: "inline-block" }} />
            <span style={{ fontSize: "0.65rem", color: "#2dd4bf", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Community Contribution</span>
          </div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem", lineHeight: 1.2 }}>
            Add Data for Your District
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.7, margin: 0 }}>
            Upload research papers, government reports, survey data, or photos of health records.
            Our AI extracts the metrics and an admin reviews before it goes live.
          </p>
        </div>

        {/* What's accepted */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "2rem" }}>
          {[
            { icon: "📄", label: "PDF Reports", sub: "NFHS, DLHS, SRS, HMIS" },
            { icon: "📊", label: "CSV / Excel", sub: "Tabular health data" },
            { icon: "🖼️", label: "Photos / Scans", sub: "Handwritten records, posters" },
            { icon: "📰", label: "Research Papers", sub: "Peer-reviewed studies" },
          ].map(c => (
            <div key={c.label} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.85rem 1rem", display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.3rem" }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0" }}>{c.label}</div>
                <div style={{ fontSize: "0.68rem", color: "#475569" }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>How It Works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { n: "1", text: "You upload a document with health data" },
              { n: "2", text: "Claude AI reads it and extracts structured metrics" },
              { n: "3", text: "Admin reviews the extraction for accuracy" },
              { n: "4", text: "Approved data enriches the district profile" },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#0d948820", border: "1px solid #0d948840", color: "#2dd4bf", fontSize: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
          <ContributeForm />
        </div>
      </div>
    </div>
  );
}
