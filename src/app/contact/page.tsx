import type { Metadata } from "next";
import Link from "next/link";
import VyasaLogo from "@/components/VyasaLogo";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Vyasa team — partnerships, data corrections, media, and general inquiries.",
};

const LINKEDIN = "https://www.linkedin.com/company/vyasa-integrated-healthcare-private-limited/?viewAsMember=true";

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "4rem 1.5rem 6rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <VyasaLogo size={36} />
            <div>
              <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Vyasa</div>
              <div style={{ fontSize: "0.6rem", color: "#2dd4bf", letterSpacing: "0.12em", textTransform: "uppercase" }}>Public Health Platform</div>
            </div>
          </div>
          <h1 className="font-display" style={{ fontSize: "2.25rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>
            Contact Us
          </h1>
          <p style={{ fontSize: "0.95rem", color: "#64748b", lineHeight: 1.7, maxWidth: "520px" }}>
            Whether you have a data correction, partnership inquiry, media request, or just want to say hello — we&apos;d love to hear from you.
          </p>
        </div>

        {/* Cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>

          {/* LinkedIn */}
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem", textDecoration: "none", transition: "border-color 0.2s" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", backgroundColor: "#0077b520", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa" }}>
              <LinkedInIcon />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "0.2rem" }}>LinkedIn</div>
              <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>Follow Vyasa Integrated Healthcare for product updates, health insights and hiring announcements.</div>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#60a5fa", marginTop: "auto" }}>Visit our LinkedIn page →</div>
          </a>

          {/* Email */}
          <a href="mailto:support@vyasaa.com"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem", textDecoration: "none" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", backgroundColor: "#0d948820", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
              ✉️
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "0.2rem" }}>Email</div>
              <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>For partnerships, media inquiries, data contributions, and general feedback.</div>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#2dd4bf", marginTop: "auto" }}>support@vyasaa.com</div>
          </a>

          {/* Data corrections */}
          <Link href="/contribute"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem", textDecoration: "none" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", backgroundColor: "#6366f120", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
              📎
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "0.2rem" }}>Data Corrections</div>
              <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>Found a data discrepancy? Submit a correction or contribute updated health data from official sources.</div>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#a78bfa", marginTop: "auto" }}>Submit correction →</div>
          </Link>

          {/* Feedback */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", backgroundColor: "#eab30820", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
              💬
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "0.2rem" }}>In-App Feedback</div>
              <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>Use the feedback button (bottom-right on any page) to report bugs, suggest features or flag inaccurate data.</div>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#fbbf24", marginTop: "auto" }}>Available on every page</div>
          </div>
        </div>

        {/* Company info */}
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.75rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#2dd4bf", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "1rem" }}>Company</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
            {[
              { label: "Company",     value: "Vyasa Integrated Healthcare Pvt. Ltd." },
              { label: "Platform",    value: "Vyasa (healthforindia.vyasa.health)" },
              { label: "Registered",  value: "India" },
              { label: "Data Policy", value: "Reference only — not for clinical decisions" },
            ].map(r => (
              <div key={r.label}>
                <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>{r.label}</div>
                <div style={{ fontSize: "0.82rem", color: "#e2e8f0", lineHeight: 1.5 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
