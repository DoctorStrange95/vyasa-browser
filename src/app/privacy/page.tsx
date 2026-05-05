import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Vyasa collects, uses and protects your personal data.",
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

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "4rem 1.5rem 6rem" }}>

        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#334155", marginBottom: "3rem" }}>
          Effective date: {EFFECTIVE} · Vyasa Integrated Healthcare Pvt. Ltd.
        </p>

        <Section title="1. Who we are">
          <p>Vyasa is operated by <strong style={{ color: "#e2e8f0" }}>Vyasa Integrated Healthcare Private Limited</strong>, a company registered in India. We build tools that make public health data accessible to citizens, policymakers and researchers. This policy explains how we handle personal information when you use our platform at <em>healthforindia.vyasa.health</em> (the "Platform").</p>
        </Section>

        <Section title="2. Data we collect">
          <p style={{ marginBottom: "0.75rem" }}>We collect the minimum data needed to provide our services:</p>
          <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <li><strong style={{ color: "#e2e8f0" }}>Account data</strong> — name, email address and hashed password when you register as a citizen user.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Profile data</strong> — phone number, location (city/district), age — only if you choose to add them.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Health Locker files</strong> — documents you upload (reports, prescriptions) are stored encrypted and accessible only by you.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Submissions</strong> — health data documents you contribute are stored with your email to allow status tracking.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Usage data</strong> — standard server logs (IP address, browser type, pages visited) for security and debugging. These are not sold or shared.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Cookies</strong> — session cookies for authentication and analytics cookies (Google Analytics / Vercel Analytics) to understand usage. See our <a href="/cookies" style={{ color: "#60a5fa" }}>Cookie Policy</a>.</li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <li>To provide and personalise the Platform (state health stats, facility finder, health locker).</li>
            <li>To verify your identity and secure your account.</li>
            <li>To process data submissions and notify you of their review status.</li>
            <li>To improve the Platform based on aggregated, anonymised usage patterns.</li>
            <li>To respond to your support or feedback requests.</li>
          </ul>
          <p style={{ marginTop: "0.75rem" }}>We do <strong style={{ color: "#e2e8f0" }}>not</strong> sell your personal data to third parties. We do not use your health locker data for advertising or model training.</p>
        </Section>

        <Section title="4. Data storage and security">
          <p>All data is stored in Google Cloud (Firebase / Firestore) with servers located in Asia (Mumbai region). Passwords are hashed using <em>scrypt</em> with a random salt — we cannot recover your password. Health locker files are stored as encrypted blobs accessible only via authenticated API calls. We use HTTPS for all data in transit.</p>
        </Section>

        <Section title="5. Data retention">
          <p>Account data is retained for as long as your account is active. If you delete your account, personal data is permanently removed within 30 days. Health locker files are deleted immediately upon your request. Anonymised aggregate statistics derived from submissions may be retained indefinitely.</p>
        </Section>

        <Section title="6. Your rights">
          <p style={{ marginBottom: "0.75rem" }}>Under applicable Indian data protection law (DPDPA 2023) and, where applicable, GDPR, you have the right to:</p>
          <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <li><strong style={{ color: "#e2e8f0" }}>Access</strong> — request a copy of personal data we hold about you.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Correction</strong> — update inaccurate data via your profile settings.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Deletion</strong> — request account and data deletion by emailing us.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Portability</strong> — receive your data in a machine-readable format.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Objection</strong> — opt out of analytics cookies via Cookie Settings in the footer.</li>
          </ul>
          <p style={{ marginTop: "0.75rem" }}>To exercise any right, email <strong style={{ color: "#e2e8f0" }}>support@vyasaa.com</strong>. We will respond within 30 days.</p>
        </Section>

        <Section title="7. Third-party services">
          <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <li><strong style={{ color: "#e2e8f0" }}>Google Maps / Places API</strong> — used for nearby facility search. Google&apos;s privacy policy applies to location data passed in API requests.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Nominatim (OpenStreetMap)</strong> — used for reverse geocoding GPS coordinates. No personal data is stored by Nominatim.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Vercel</strong> — hosting provider. Edge logs are subject to Vercel&apos;s privacy policy.</li>
            <li><strong style={{ color: "#e2e8f0" }}>Firebase / Google Cloud</strong> — database and authentication infrastructure.</li>
          </ul>
        </Section>

        <Section title="8. Children">
          <p>Vyasa is not directed at children under 13. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it promptly.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>We may update this policy as the Platform evolves. Material changes will be flagged with an updated effective date. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about this policy? Email <strong style={{ color: "#e2e8f0" }}>support@vyasaa.com</strong> or visit our <a href="/contact" style={{ color: "#60a5fa" }}>Contact page</a>.</p>
        </Section>

      </div>
    </div>
  );
}
