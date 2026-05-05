import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Vyasa uses cookies and how you can manage your preferences.",
};

const EFFECTIVE = "1 April 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2.25rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.75rem" }}>{title}</h2>
      <div style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.85 }}>{children}</div>
    </section>
  );
}

export default function CookiesPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "4rem 1.5rem 6rem" }}>

        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
          Cookie Policy
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#334155", marginBottom: "3rem" }}>
          Effective date: {EFFECTIVE} · Vyasa Integrated Healthcare Pvt. Ltd.
        </p>

        <Section title="What are cookies?">
          <p>Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work, improve efficiency, and provide analytics to site owners. We also use similar technologies like localStorage for storing your cookie consent preference.</p>
        </Section>

        <Section title="Cookies we use">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.25rem" }}>
            {[
              {
                name: "vyasa_user_session",
                type: "Strictly Necessary",
                typeColor: "#22c55e",
                duration: "30 days",
                purpose: "Authentication. Keeps you logged in to your citizen account. This cookie cannot be disabled as the Platform cannot function without it for logged-in users.",
              },
              {
                name: "vyasa_admin_session",
                type: "Strictly Necessary",
                typeColor: "#22c55e",
                duration: "Session",
                purpose: "Admin authentication. Only set when an admin logs in to the admin panel.",
              },
              {
                name: "_vercel_analytics",
                type: "Analytics",
                typeColor: "#eab308",
                duration: "1 year",
                purpose: "Vercel Web Analytics — measures page views, referrers and device types in aggregate. No personal identifiers are stored.",
              },
              {
                name: "cookie_consent",
                type: "Preference",
                typeColor: "#60a5fa",
                duration: "1 year",
                purpose: "Stores your cookie consent choice (accepted / declined analytics) so we do not ask again on every visit.",
              },
            ].map(c => (
              <div key={c.name} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <code style={{ fontSize: "0.78rem", color: "#a78bfa", backgroundColor: "#1e1b4b", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>{c.name}</code>
                  <span style={{ fontSize: "0.65rem", backgroundColor: c.typeColor + "20", color: c.typeColor, padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>{c.type}</span>
                  <span style={{ fontSize: "0.7rem", color: "#475569" }}>Duration: {c.duration}</span>
                </div>
                <p style={{ margin: 0 }}>{c.purpose}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Managing your preferences">
          <p style={{ marginBottom: "0.75rem" }}>You can control cookies in several ways:</p>
          <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li><strong style={{ color: "#e2e8f0" }}>Cookie banner</strong> — when you first visit Vyasa, a banner lets you accept all cookies or decline analytics cookies.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Cookie Settings link</strong> — in the footer, clicking &quot;Cookie Settings&quot; resets your preference so the banner reappears.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Browser settings</strong> — most browsers let you block or delete cookies. Note that blocking strictly necessary cookies will prevent login from working.</li>
          </ul>
        </Section>

        <Section title="Third-party cookies">
          <p>Google Maps and Places API may set their own cookies when you use the facility finder feature. These are governed by Google&apos;s Privacy Policy. We do not have access to or control over these cookies.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy when we add new features. The effective date at the top of this page will be updated accordingly.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about cookies? Email <strong style={{ color: "#e2e8f0" }}>support@vyasaa.com</strong> or visit our <a href="/contact" style={{ color: "#60a5fa" }}>Contact page</a>.</p>
        </Section>

      </div>
    </div>
  );
}
