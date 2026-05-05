import Link from "next/link";
import WaitlistForm from "@/components/WaitlistForm";

export const metadata = {
  title: "Join Vyasa — Early Access Waitlist",
  description: "Built from the ward, not the boardroom. Digital prescriptions, real-time care coordination, AI analytics and outbreak surveillance — for Indian doctors and hospitals.",
};

const STATS = [
  {
    value: "70%",
    label: "of serious medical errors",
    sub: "involve miscommunication during patient handoffs",
    cite: "JCAHO Sentinel Event Report 2023",
    color: "#f87171",
    bg: "#1a0808",
    border: "#3a1010",
  },
  {
    value: "73.9%",
    label: "of Indian doctors",
    sub: "burdened with non-medical clerical work daily",
    cite: "FAIMA Survey · 28 States",
    color: "#f59e0b",
    bg: "#1a1208",
    border: "#3a2a10",
  },
  {
    value: "30–35",
    label: "outbreaks weekly in India",
    sub: "yet private hospitals have zero IDSP integration",
    cite: "MoHFW · IDSP Surveillance",
    color: "#6366f1",
    bg: "#0e0d1e",
    border: "#1e1c40",
  },
];

const FEATURES = [
  { icon: "✍️", title: "Kill Paper Prescriptions", desc: "Digital Rx with drug-interaction alerts, auto-history fill, and one-tap send to pharmacy. Zero handwriting errors." },
  { icon: "🔴", title: "Live SOS Alerts",          desc: "Nurses trigger emergency alerts from the bedside. Doctors see patient condition remotely and schedule accordingly." },
  { icon: "🔗", title: "Lab → Doctor in Seconds",   desc: "Results push in real-time. Critical values auto-alert the care team before the patient deteriorates." },
  { icon: "🧾", title: "Auto-Bills Every Action",   desc: "Every clinical action — drug, procedure, vital — translates to an invoice. Zero revenue leakage." },
  { icon: "📊", title: "AI Clinical Analytics",     desc: "AI discharge summaries generated automatically. NCD vs. infectious disease burden projected by district." },
  { icon: "📡", title: "Public Health Intelligence", desc: "Real-time IDSP outbreak alerts and NCD burden data surfaced directly in your workflow — not buried in government PDFs." },
];

const HOW = [
  { step: "01", title: "Doctor Prescribes",   desc: "Drug, procedures, vitals, drains — clinical intent captured instantly. No handwriting, no clipboard." },
  { step: "02", title: "Nurse Administers",   desc: "MAR auto-populates with timestamped dispensing. Real-time chat with doctor. Pharmacy pinged instantly." },
  { step: "03", title: "System Auto-Bills",   desc: "Every clinical action converts to a billable item. No admin rekeying. Zero billing errors or revenue leakage." },
];

export default function JoinPage() {
  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <section style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "4rem 1.5rem 3.5rem" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#0d948815", border: "1px solid #0d948840", borderRadius: "6px", padding: "0.3rem 0.9rem", marginBottom: "1.5rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#2dd4bf", display: "inline-block", animation: "pulseGlow 2s infinite" }} />
            <span style={{ fontSize: "0.68rem", color: "#2dd4bf", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Early Access</span>
          </div>

          <h1 style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
            Built from the ward,<br />not the boardroom.
          </h1>

          <p style={{ fontSize: "1rem", color: "#64748b", lineHeight: 1.8, marginBottom: "1rem", maxWidth: "620px", margin: "0 auto 1rem" }}>
            Vyasa is India&apos;s clinical coordination system — connecting doctors, nurses, pharmacy, labs, and patients in real-time. Designed by a practicing physician. Built for how hospitals actually work.
          </p>
          <p style={{ fontSize: "0.8rem", color: "#334155", margin: "0 auto 2.5rem", fontStyle: "italic" }}>
            Dr. Nilanjan Roy · MD Community Medicine, AIIMS Patna · Founder & CEO
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {["Hospital", "Doctor", "Nurse", "Lab", "Pharmacy", "PHC / CHC"].map(r => (
              <span key={r} style={{ fontSize: "0.75rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "6px", padding: "0.3rem 0.8rem" }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem — 3 stats ── */}
      <section style={{ borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>The Problem</div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#fff" }}>India&apos;s healthcare system runs on broken workflows</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            {STATS.map(s => (
              <div key={s.value} style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, borderTop: `3px solid ${s.color}`, borderRadius: "12px", padding: "1.5rem 1.75rem" }}>
                <div style={{ fontSize: "3rem", fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: "0.5rem", fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.35rem" }}>{s.label}</div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.55, marginBottom: "0.75rem" }}>{s.sub}</div>
                <div style={{ fontSize: "0.62rem", color: "#334155", fontStyle: "italic" }}>{s.cite}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
            Broken communication between doctors, nurses, pharmacy, and labs is the #1 cause of preventable harm.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ backgroundColor: "#060e1c", borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>How It Works</div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#fff" }}>From prescription to payment — seamlessly</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0", position: "relative" }}>
            {HOW.map((h, i) => (
              <div key={h.step} style={{ position: "relative", padding: "1.75rem 1.5rem", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: i === 0 ? "12px 0 0 12px" : i === 2 ? "0 12px 12px 0" : "0", borderLeft: i > 0 ? "none" : undefined }}>
                <div style={{ fontSize: "0.6rem", color: "#0d9488", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "0.5rem" }}>STEP {h.step}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>{h.title}</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.6 }}>{h.desc}</div>
                {i < 2 && (
                  <div style={{ position: "absolute", right: "-14px", top: "50%", transform: "translateY(-50%)", zIndex: 2, fontSize: "1.2rem", color: "#0d9488" }}>→</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem", marginTop: "1.25rem" }}>
            {[
              "Zero handwriting errors",
              "Real-time tracking across every stakeholder",
              "Auto-documentation — MAR, billing, discharge",
              "Every clinical action converts to revenue",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "#94a3b8", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "7px", padding: "0.55rem 0.85rem" }}>
                <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>{t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features 6-grid ── */}
      <section style={{ borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>What You Get</div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#fff" }}>One platform. Every role. Zero paperwork.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.85rem" }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.25rem 1.4rem" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: "0.6rem" }}>{f.icon}</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.4rem" }}>{f.title}</div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM (the strategic placement — after seeing the problem & solution) ── */}
      <section id="join-form" style={{ padding: "3.5rem 1.5rem 5rem" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {/* Strong CTA above form */}
          <div style={{ backgroundColor: "#0a1628", border: "1px solid #0d948850", borderRadius: "14px", padding: "1.75rem 2rem", marginBottom: "2.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              Be among the first 100 clinicians on Vyasa
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 auto", maxWidth: "480px", lineHeight: 1.7 }}>
              We&apos;re rolling out by specialization and region. Fill in 2 minutes — we&apos;ll contact you for a personalized onboarding session.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: 0 }}>Request Early Access</h2>
            <span style={{ fontSize: "0.62rem", backgroundColor: "#6366f120", color: "#818cf8", border: "1px solid #6366f140", borderRadius: "4px", padding: "0.15rem 0.5rem", fontWeight: 700 }}>~2 min</span>
          </div>
          <WaitlistForm />
        </div>
      </section>

      {/* ── Footer strip ── */}
      <section style={{ backgroundColor: "#060e1c", borderTop: "1px solid #1e3a5f", padding: "1.5rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "0.78rem", color: "#334155" }}>
          Vyasa Integrated Healthcare Pvt Ltd · Incorporated March 2026 ·{" "}
          <Link href="/" style={{ color: "#2dd4bf", textDecoration: "none" }}>Vyasa →</Link>
        </div>
      </section>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 640px) {
          .how-steps { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}
