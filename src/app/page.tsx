import type { Metadata } from "next";
import Link from "next/link";
import HealthTicker from "@/components/HealthTicker";
import IDSPWeeklyReport from "@/components/IDSPWeeklyReport";
import StateTable from "@/components/StateTable";
import JsonLd from "@/components/JsonLd";
import HomeSearch from "@/components/HomeSearch";
import DoctorDirectory from "@/components/DoctorDirectory";
import states from "@/data/states.json";

const PORTAL = "https://app.vyasaa.com";

export const metadata: Metadata = {
  title: "India's Public Health Transparency Platform | NFHS-6 Data & NFHS-5 vs 6",
  description:
    "NFHS-6 (2023-24) data and full NFHS-5 vs NFHS-6 comparison for India and every state/UT — vaccination, stunting, fertility, maternal care and NCDs — plus district-level infant mortality, disease outbreaks and hospital infrastructure. SRS 2023 · MoHFW.",
  keywords: [
    "NFHS-6 data", "NFHS-6 2023-24", "NFHS-5 vs NFHS-6", "NFHS 5 vs 6", "NFHS-6 India",
    "NFHS-6 state wise data", "National Family Health Survey 6 data", "NFHS-6 vs NFHS-5 comparison",
    "India public health data", "infant mortality rate India state wise", "IDSP outbreak report India",
  ],
  alternates: { canonical: "https://www.vyasaa.com" },
};

/* ── Health score ── */
function healthScore(s: typeof states[number]): number {
  const imrS   = s.imr                    != null ? Math.max(0, 100 - (s.imr / 55) * 100)             : 50;
  const vaccS  = s.vaccinationPct         != null ? s.vaccinationPct                                   : 50;
  const ibS    = s.institutionalBirthsPct != null ? s.institutionalBirthsPct                           : 50;
  const stuntS = s.stuntingPct            != null ? Math.max(0, 100 - (s.stuntingPct / 50) * 100)     : 50;
  const anaemS = s.womenAnaemiaPct        != null ? Math.max(0, 100 - (s.womenAnaemiaPct / 75) * 100) : 50;
  return Math.round(imrS * 0.30 + vaccS * 0.25 + ibS * 0.20 + stuntS * 0.15 + anaemS * 0.10);
}
function scoreColor(v: number) {
  if (v >= 80) return "#22c55e";
  if (v >= 65) return "#84cc16";
  if (v >= 50) return "#eab308";
  if (v >= 35) return "#f97316";
  return "#ef4444";
}

const ranked      = [...states].map(s => ({ ...s, score: healthScore(s) })).sort((a, b) => b.score - a.score);
const topStates   = ranked.slice(0, 6);
const bottomStates= ranked.slice(-4);
const natAvgIMR   = Math.round(states.filter(s => s.imr).reduce((a, s) => a + (s.imr ?? 0), 0) / states.filter(s => s.imr).length);
const natAvgVacc  = Math.round(states.filter(s => s.vaccinationPct).reduce((a, s) => a + (s.vaccinationPct ?? 0), 0) / states.filter(s => s.vaccinationPct).length);

export default function HomePage() {
  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": "https://www.vyasaa.com/#website",
            "url": "https://www.vyasaa.com",
            "name": "Vyasa",
            "description": "India's public health transparency platform with district-level data on IMR, vaccination, disease outbreaks, hospital infrastructure, nutrition and air quality.",
            "publisher": { "@type": "Organization", "name": "Vyasa Health", "url": "https://www.vyasaa.com" },
            "potentialAction": { "@type": "SearchAction", "target": "https://www.vyasaa.com/district/{search_term_string}", "query-input": "required name=search_term_string" },
          },
          {
            "@type": "Dataset",
            "name": "India Public Health Statistics",
            "description": "Comprehensive district-level health metrics for all Indian states and UTs including IMR, vaccination coverage, institutional births, stunting, anaemia and disease surveillance data.",
            "url": "https://www.vyasaa.com",
            "creator": { "@type": "Organization", "name": "Vyasa Health" },
            "license": "https://creativecommons.org/licenses/by/4.0/",
            "keywords": ["India", "public health", "IMR", "vaccination", "NFHS-6", "IDSP", "disease surveillance"],
            "spatialCoverage": { "@type": "Place", "name": "India" },
            "temporalCoverage": "2023",
            "distribution": [{ "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://www.vyasaa.com/api/idsp" }],
          },
        ],
      }} />
      <HealthTicker />

      {/* ── PAGE CONTENT ─────────────────────────────────────────── */}
      <div>

          {/* ── HERO ────────────────────────────────────────────── */}
          <section id="sec-hero" className="home-hero" style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "2.5rem 1.5rem 2rem" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ maxWidth: "560px", flex: "1 1 280px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "#0d948820", color: "#2dd4bf", border: "1px solid #0d948840", borderRadius: "4px", padding: "0.15rem 0.5rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Live · Updated Daily</span>
                    <span style={{ fontSize: "0.6rem", color: "#334155" }}>SRS 2023 · NFHS-6 · IDSP</span>
                  </div>
                  <h1 className="font-display hero-heading" style={{ fontSize: "clamp(1.6rem,4vw,2.6rem)", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "0.65rem" }}>
                    India&apos;s Public Health<br />Transparency Platform
                  </h1>
                  <p className="hero-subtext" style={{ fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                    District-level health data: infant mortality, vaccination, disease surveillance, hospital infrastructure, nutrition & air quality.
                  </p>
                  <div className="hero-cta" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <Link href="#sec-states" style={{ backgroundColor: "#0d9488", color: "#fff", padding: "0.7rem 1.4rem", borderRadius: "7px", fontSize: "0.92rem", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: "44px" }}>
                      Explore States →
                    </Link>
                    <Link href="/contribute" style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "0.7rem 1.1rem", borderRadius: "7px", textDecoration: "none", fontSize: "0.92rem", fontWeight: 600, display: "inline-flex", alignItems: "center", minHeight: "44px" }}>
                      📎 Contribute Data
                    </Link>
                  </div>
                </div>
                <div className="hero-stat-cards" style={{ flex: "0 0 auto" }}>
                  {[
                    { label: "States & UTs Tracked",   value: String(states.length), icon: "🗺️", color: "#2dd4bf" },
                    { label: "Nat. Avg. IMR (2023)",    value: `${natAvgIMR}/1k`,     icon: "👶", color: "#f97316" },
                    { label: "Avg. Vaccination Cover",  value: `${natAvgVacc}%`,      icon: "💉", color: "#22c55e" },
                    { label: "Data Points Tracked",     value: "780+",                icon: "📊", color: "#6366f1" },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1rem 1.1rem" }}>
                      <div style={{ fontSize: "1.1rem", marginBottom: "0.3rem" }}>{s.icon}</div>
                      <div className="font-data" style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem", lineHeight: 1.3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* ── Search bar ── */}
              <HomeSearch />
            </div>
          </section>

          {/* ── NFHS-5 vs NFHS-6 RESEARCH BANNER ──────────────────── */}
          <section id="sec-nfhs" className="home-section" style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem" }}>
              <div style={{ background: "linear-gradient(135deg, #062e2b 0%, #0a1628 60%)", border: "1px solid #0d948855", borderRadius: "14px", padding: "1.5rem 2rem", display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: "240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1.4rem" }}>📊</span>
                    <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>NFHS-6 (2023-24) vs NFHS-5</span>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "#0d948820", color: "#2dd4bf", border: "1px solid #0d948840", borderRadius: "4px", padding: "0.2rem 0.55rem", fontFamily: "monospace", fontWeight: 600 }}>NEW · for researchers</span>
                  </div>
                  <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: 0, lineHeight: 1.65 }}>
                    Full India &amp; state-wise comparison of the latest National Family Health Survey — vaccination, stunting, fertility, maternal care and NCDs, with the change from NFHS-5 and a trend analysis for every state and UT.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", flexShrink: 0 }}>
                  <a href="/nfhs-6" style={{ backgroundColor: "#0d9488", color: "#fff", borderRadius: "9px", padding: "0.7rem 1.4rem", fontSize: "0.88rem", fontWeight: 700, textDecoration: "none" }}>India analysis →</a>
                  <a href="/states" style={{ background: "#0f2040", border: "1px solid #1e3a5f", color: "#cbd5e1", borderRadius: "9px", padding: "0.7rem 1.4rem", fontSize: "0.88rem", fontWeight: 700, textDecoration: "none" }}>State comparison →</a>
                </div>
              </div>
            </div>
          </section>


          {/* ── IDSP WEEKLY REPORT ──────────────────────────────── */}
          <section id="sec-idsp" className="home-section" style={{ borderBottom: "1px solid #1e3a5f", backgroundColor: "#06090f" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "1rem" }}>🚨</span>
                <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>IDSP Weekly Outbreak Report</h2>
                <span style={{ fontSize: "0.7rem", backgroundColor: "#ef444420", color: "#f87171", border: "1px solid #ef444440", borderRadius: "4px", padding: "0.1rem 0.4rem", fontFamily: "monospace" }}>NCDC · MoHFW · Official</span>
                <span style={{ fontSize: "0.75rem", color: "#475569", marginLeft: "auto" }}>
                  Scraped weekly from{" "}
                  <a href="https://idsp.mohfw.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "underline" }}>idsp.mohfw.gov.in</a>
                </span>
              </div>
              <IDSPWeeklyReport />
            </div>
          </section>

          {/* ── HEALTH LEADERS ──────────────────────────────────── */}
          <section id="sec-leaders" className="home-section" style={{ borderBottom: "1px solid #1e3a5f" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1rem" }}>🏆</span>
                  <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>Health Leaders</h2>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Composite index: IMR · Vaccination · Nutrition · Births</span>
                </div>
                <Link href="#sec-states" style={{ fontSize: "0.78rem", color: "#0d9488", textDecoration: "none", fontWeight: 600 }}>
                  View all →
                </Link>
              </div>

              <div className="leaders-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.85rem", marginBottom: "2rem" }}>
                {topStates.map((s, i) => {
                  const col = scoreColor(s.score);
                  return (
                    <Link key={s.slug} href={`/state/${s.slug}`} style={{ textDecoration: "none" }}>
                      <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderTop: `3px solid ${col}`, borderRadius: "10px", padding: "1rem", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "#475569", fontFamily: "monospace", fontWeight: 600 }}>#{i + 1}</span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0" }}>{s.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <div className="font-data" style={{ fontSize: "1.7rem", fontWeight: 700, color: col, lineHeight: 1 }}>{s.score}</div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.35 }}>Health<br />Score</div>
                        </div>
                        <div style={{ height: "4px", backgroundColor: "#080f1e", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${s.score}%`, backgroundColor: col, borderRadius: "2px" }} />
                        </div>
                        {s.imr != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.72rem", color: "#64748b" }}>
                            <span>IMR: <span style={{ color: "#94a3b8" }}>{s.imr}</span></span>
                            <span>Vacc: <span style={{ color: "#94a3b8" }}>{s.vaccinationPct ?? "—"}%</span></span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div style={{ backgroundColor: "#0a1628", border: "1px solid #ef444425", borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <span style={{ fontSize: "0.9rem" }}>⚠️</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.07em" }}>Needs Attention</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.6rem" }}>
                  {bottomStates.map(s => {
                    const col = scoreColor(s.score);
                    return (
                      <Link key={s.slug} href={`/state/${s.slug}`} style={{ textDecoration: "none" }}>
                        <div style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{s.name}</span>
                          <div className="font-data" style={{ fontSize: "1rem", fontWeight: 700, color: col }}>{s.score}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ── ALL STATES TABLE ────────────────────────────────── */}
          <section id="sec-states" className="home-section" style={{ borderBottom: "1px solid #1e3a5f" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1rem" }}>📋</span>
                <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>All States & Union Territories</h2>
                <a href="/states" style={{ marginLeft: "auto", fontSize: "0.8rem", fontWeight: 700, color: "#2dd4bf", textDecoration: "none", border: "1px solid #0d948855", borderRadius: 8, padding: "0.4rem 0.8rem", whiteSpace: "nowrap" }}>
                  NFHS-5 vs NFHS-6 comparison →
                </a>
              </div>
              <StateTable states={states} />
            </div>
          </section>

          {/* ── NCD BURDEN ──────────────────────────────────────── */}
          <section id="sec-ncd" className="home-section" style={{ backgroundColor: "#060e1c", borderTop: "1px solid #f9731620", borderBottom: "1px solid #f9731620" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1rem" }}>🫀</span>
                <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>Non-Communicable Disease Burden — India</h2>
                <span style={{ fontSize: "0.7rem", backgroundColor: "#f9731620", color: "#fb923c", border: "1px solid #f9731640", borderRadius: "4px", padding: "0.2rem 0.5rem", fontFamily: "monospace", fontWeight: 600 }}>NCD</span>
              </div>
              <div className="national-stats-grid">
                {[
                  { icon: "🫀", value: "4.77M", label: "Cardiovascular Deaths", sub: "annually · #1 NCD killer" },
                  { icon: "🩸", value: "101M",  label: "Diabetes Prevalence",   sub: "adults · IDF 2023" },
                  { icon: "🎗️", value: "1.46M", label: "Cancer Cases/Year",     sub: "new cases · NCRP 2022" },
                  { icon: "🫁", value: "55M",   label: "COPD Patients",         sub: "estimated · ICMR" },
                  { icon: "🫘", value: "17%",   label: "CKD Prevalence",        sub: "of adults screened" },
                  { icon: "🫀", value: "38.6%", label: "NAFLD Prevalence",      sub: "in urban India" },
                  { icon: "📊", value: "66%",   label: "NCD Share of Deaths",   sub: "of all deaths · WHO" },
                  { icon: "🏥", value: "36",    label: "NPCDCS Coverage",       sub: "states &amp; UTs · MoHFW" },
                ].map((stat, i) => (
                  <div key={i} style={{ padding: "0.9rem 0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", marginBottom: "0.1rem" }}>{stat.icon}</div>
                    <div className="font-data" style={{ fontSize: "1.35rem", fontWeight: 600, color: "#fb923c", marginBottom: "0.15rem" }}>{stat.value}</div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.2rem" }}>{stat.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }} dangerouslySetInnerHTML={{ __html: stat.sub }} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CONTRIBUTE BANNER ───────────────────────────────── */}
          <section id="sec-contribute" className="home-section" style={{ borderBottom: "1px solid #1e3a5f" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
              <div className="contribute-inner" style={{ backgroundColor: "#0a1628", border: "1px solid #0d948840", borderRadius: "12px", padding: "1.75rem 2rem", display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>📎</span>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>Contribute Health Data</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                    Upload PDFs, CSVs, Excel sheets or images. Our AI extracts structured health metrics and routes them for admin review before publishing.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {["PDF", "CSV", "Excel", "Images"].map(t => (
                    <span key={t} style={{ fontSize: "0.72rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "5px", padding: "0.25rem 0.65rem" }}>{t}</span>
                  ))}
                </div>
                <Link href="/contribute" style={{ backgroundColor: "#0d9488", color: "#fff", padding: "0.65rem 1.5rem", borderRadius: "8px", textDecoration: "none", fontSize: "0.88rem", fontWeight: 700, flexShrink: 0 }}>
                  Submit Data →
                </Link>
              </div>
            </div>
          </section>

          {/* ── DOCTOR DIRECTORY ────────────────────────────────── */}
          <section id="sec-doctors" className="home-section" style={{ borderBottom: "1px solid #1e3a5f", backgroundColor: "#060e1c" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
              {/* Section hero */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.75rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0d9488", display: "inline-block", animation: "pulseGlow 2s infinite" }} />
                    <span style={{ fontSize: "0.68rem", color: "#2dd4bf", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Live Doctor Directory
                    </span>
                  </div>
                  <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: 0, letterSpacing: "-0.02em" }}>
                    Find & Book a Doctor<br />
                    <span style={{ color: "#0d9488" }}>Anywhere in India</span>
                  </h2>
                  <p style={{ fontSize: "0.92rem", color: "#64748b", marginTop: "0.5rem", lineHeight: 1.7, maxWidth: 540 }}>
                    Browse verified doctors listed on Vyasa Health OS — search by state, district, city or specialty.
                    Every profile has live slot availability. Book directly from this page.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "flex-start" }}>
                  <a href={`${PORTAL}/register`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0f2040", border: "1px solid #0d948850", color: "#2dd4bf", borderRadius: 9, padding: "0.6rem 1.1rem", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                    👨‍⚕️ Are you a doctor? Get listed →
                  </a>
                  <span style={{ fontSize: "0.68rem", color: "#334155" }}>Free · Takes 2 minutes · Instant booking page</span>
                </div>
              </div>

              {/* Stats bar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                  { icon: "🩺", label: "Instant Booking", desc: "Select a slot, confirm in 30 seconds" },
                  { icon: "📍", label: "State/City/District", desc: "Filter doctors near you" },
                  { icon: "🔒", label: "Verified Doctors", desc: "MCI/NMC registration confirmed" },
                  { icon: "📱", label: "WhatsApp & QR", desc: "Share or scan — no app needed" },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#080f1e", border: "1px solid #1e3a5f", borderRadius: 8, padding: "0.5rem 0.85rem", flex: "1 1 180px" }}>
                    <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#e2e8f0" }}>{f.label}</div>
                      <div style={{ fontSize: "0.67rem", color: "#475569" }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* The directory component */}
              <DoctorDirectory />
            </div>
          </section>

          {/* ── FOR DOCTORS — PORTAL CTA ────────────────────────── */}
          <section id="sec-doctor-portal" style={{ borderBottom: "1px solid #1e3a5f", background: "linear-gradient(135deg, #060e1c 0%, #0a1628 50%, #060e1c 100%)" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
              <div style={{ background: "linear-gradient(135deg, #0a1628, #0f2040)", border: "1px solid #1B4F8A50", borderRadius: 18, padding: "2rem 2.5rem", display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                {/* Glow */}
                <div style={{ position: "absolute", top: -60, right: 80, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, #1B4F8A20 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.62rem", background: "#1B4F8A30", color: "#93c5fd", border: "1px solid #1B4F8A50", borderRadius: 4, padding: "0.15rem 0.5rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>For Doctors</span>
                  </div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", marginBottom: "0.5rem", lineHeight: 1.25 }}>
                    Your clinic.&nbsp;Your booking link.<br />
                    <span style={{ color: "#2dd4bf" }}>Zero commission.</span>
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.75, maxWidth: 500, margin: 0 }}>
                    Join Vyasa Health OS as a doctor. Get a personal booking page (vyasaa.com/dr/your-name),
                    a QR code for your visiting card, slot-based appointment management,
                    and a full HMIS — prescriptions, OPD queue, billing, lab orders and more.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1rem" }}>
                    {["📄 Digital prescriptions", "📅 Slot-based booking", "📱 Patient-facing public page", "🔲 QR code included", "🏥 Multi-clinic support", "💰 No commission"].map(f => (
                      <span key={f} style={{ fontSize: "0.72rem", background: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: 6, padding: "0.25rem 0.65rem" }}>{f}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center", flexShrink: 0 }}>
                  <a href={`${PORTAL}/register`} target="_blank" rel="noopener noreferrer"
                    style={{ background: "#0d9488", color: "#fff", padding: "0.9rem 2rem", borderRadius: 11, textDecoration: "none", fontSize: "0.95rem", fontWeight: 800, display: "block", textAlign: "center", minWidth: 200, boxShadow: "0 4px 20px #0d948840" }}>
                    Register as a Doctor →
                  </a>
                  <a href={`${PORTAL}/login`} target="_blank" rel="noopener noreferrer"
                    style={{ background: "none", border: "1px solid #1e3a5f", color: "#64748b", padding: "0.7rem 2rem", borderRadius: 11, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, display: "block", textAlign: "center", minWidth: 200 }}>
                    Already a member? Sign in →
                  </a>
                  <span style={{ fontSize: "0.65rem", color: "#334155", textAlign: "center" }}>
                    Free to start · No credit card needed
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── JOIN VYASA WAITLIST ──────────────────────────────── */}
          <section id="sec-join" className="home-section" style={{ borderBottom: "1px solid #1e3a5f", backgroundColor: "#060e1c" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {[
                  { val: "70%",   label: "of serious medical errors",        sub: "caused by miscommunication in handoffs", color: "#f87171", cite: "JCAHO 2023" },
                  { val: "73.9%", label: "of Indian doctors",                sub: "burdened by non-medical clerical work",  color: "#f59e0b", cite: "FAIMA · 28 States" },
                  { val: "30–35", label: "disease outbreaks weekly in India", sub: "yet private hospitals lack IDSP access", color: "#818cf8", cite: "MoHFW · IDSP" },
                ].map(s => (
                  <div key={s.val} style={{ backgroundColor: "#080f1e", border: `1px solid ${s.color}30`, borderLeft: `3px solid ${s.color}`, borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, lineHeight: 1, fontFamily: "monospace", flexShrink: 0 }}>{s.val}</div>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>{s.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4, marginTop: "0.2rem" }}>{s.sub}</div>
                      <div style={{ fontSize: "0.58rem", color: "#334155", marginTop: "0.3rem", fontStyle: "italic" }}>{s.cite}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="join-inner-box" style={{
                background: "linear-gradient(135deg, #0a1628 0%, #0f2040 50%, #0a1628 100%)",
                border: "1px solid #0d948850", borderRadius: "16px", padding: "2rem 2.5rem",
                display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "center", justifyContent: "space-between",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: "-40px", right: "100px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, #0d948825 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#2dd4bf", display: "inline-block", animation: "pulseGlow 2s infinite" }} />
                    <span style={{ fontSize: "0.62rem", color: "#2dd4bf", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Early Access</span>
                  </div>
                  <h2 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                    Built from the ward,<br />not the boardroom.
                  </h2>
                  <p style={{ fontSize: "0.83rem", color: "#64748b", lineHeight: 1.7, margin: 0, maxWidth: "460px" }}>
                    One platform for every role — digital Rx, live lab sync, nurse SOS alerts, auto-billing, AI discharge summaries, and IDSP outbreak feeds. Designed by an AIIMS physician.
                  </p>
                </div>
                <div className="join-features" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "flex-start" }}>
                  {[
                    { icon: "✍️", text: "Kill paper prescriptions" },
                    { icon: "🔴", text: "Live SOS alerts & remote monitoring" },
                    { icon: "🔗", text: "Lab results reach doctor in seconds" },
                    { icon: "🧾", text: "Every action auto-bills — zero leakage" },
                  ].map(f => (
                    <div key={f.text} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "#94a3b8" }}>
                      <span>{f.icon}</span><span>{f.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "center", flexShrink: 0 }}>
                  <a href="https://app.vyasaa.com/register" target="_blank" rel="noopener noreferrer" style={{
                    backgroundColor: "#0d9488", color: "#fff", padding: "0.9rem 2rem",
                    borderRadius: "10px", textDecoration: "none", fontSize: "0.95rem", fontWeight: 700,
                    display: "block", textAlign: "center",
                  }}>
                    Sign up →
                  </a>
                  <span style={{ fontSize: "0.68rem", color: "#475569" }}>Doctors · Hospitals · Labs · Pharmacies</span>
                </div>
              </div>
            </div>
          </section>

      </div>
    </div>
  );
}
