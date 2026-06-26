import Link from "next/link";
import VyasaLogo from "./VyasaLogo";

const LINKEDIN = "https://www.linkedin.com/company/vyasa-integrated-healthcare-private-limited/?viewAsMember=true";

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#060e1c", borderTop: "1px solid #1e3a5f", padding: "3rem 1.5rem 2rem", marginTop: "5rem" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2.5rem", marginBottom: "2.5rem" }}>

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <VyasaLogo size={32} />
              <div>
                <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                  Vyasa
                </div>
                <div style={{ fontSize: "0.65rem", color: "#2dd4bf", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Public Health Platform
                </div>
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.7, maxWidth: "240px", marginBottom: "1rem" }}>
              Bringing public health transparency to every district in India. Powered by Vyasa — intelligent hospital &amp; patient management.
            </p>
            {/* Social */}
            <a href={LINKEDIN} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", backgroundColor: "#0a1e3a", border: "1px solid #1e3a5f", color: "#93c5fd", padding: "0.4rem 0.85rem", borderRadius: "7px", fontSize: "0.78rem", textDecoration: "none", fontWeight: 500 }}>
              <LinkedInIcon />
              Vyasa on LinkedIn
            </a>
          </div>

          {/* Platform */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "#2dd4bf", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>
              Platform
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <Link href="/"          style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Health Map</Link>
              <Link href="/citizens"  style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Citizens Centre</Link>
              <Link href="/sources"   style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Data Sources</Link>
              <Link href="/team"      style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Our Team</Link>
              <a href="https://app.vyasaa.com/register" target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Sign up</a>
            </div>
          </div>

          {/* Data */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "#2dd4bf", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>
              Data Sources
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <a href="https://nhp.gov.in"              target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>NHP India</a>
              <a href="https://nfhs.iipsindia.ac.in"    target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>NFHS-6</a>
              <a href="https://pmjay.gov.in"            target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>PMJAY / Ayushman</a>
              <a href="https://cpcb.nic.in"             target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>CPCB AQI</a>
              <a href="https://idsp.mohfw.gov.in"       target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>IDSP</a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "#2dd4bf", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>
              Legal & Company
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <Link href="/contact"  style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Contact Us</Link>
              <Link href="/privacy"  style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Privacy Policy</Link>
              <Link href="/cookies"  style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Cookie Policy</Link>
              <Link href="/contribute" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.875rem" }}>Contribute Data</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: "1.5rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.78rem", color: "#475569" }}>
            © 2025 Vyasa Integrated Healthcare Pvt. Ltd. Data sourced from NHP, NFHS-6, IDSP, PMJAY, CPCB. For reference only.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <p className="font-data" style={{ fontSize: "0.72rem", color: "#334155" }}>
              v2.1.0 · Updated April 2025
            </p>
            <Link href="/cookies" style={{ fontSize: "0.72rem", color: "#334155", textDecoration: "underline" }}>Cookie Settings</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
