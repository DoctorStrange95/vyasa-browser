import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { GROUPS, SRS, FAQ, type Indicator } from "./data";

const URL = "https://health.vyasaa.com/nfhs-6";

export const metadata: Metadata = {
  title: "NFHS-6 (2023-24) India: Key Indicators & NFHS-5 Comparison",
  description:
    "Full NFHS-6 (2023-24) India analysis: 101 key indicators compared with NFHS-5 (2019-21) and SRS vital rates. Fertility, vaccination, nutrition, maternal health, diabetes, obesity and women's empowerment — what changed and why.",
  keywords: [
    "NFHS-6", "NFHS 6", "NFHS-6 2023-24", "NFHS-6 India", "NFHS-6 fact sheet",
    "NFHS-6 vs NFHS-5", "NFHS-6 key indicators", "NFHS-6 data", "National Family Health Survey 6",
    "NFHS-6 TFR India", "NFHS-6 stunting", "NFHS-6 institutional births", "NFHS-6 vaccination coverage",
    "NFHS-6 caesarean section", "NFHS-6 diabetes obesity", "NFHS-6 release date", "NFHS-6 sample size",
    "NFHS-6 state fact sheet", "IIPS NFHS-6", "MoHFW NFHS-6", "SRS 2023 India IMR",
    "India fertility rate 2023-24", "India health survey 2024 results",
    "NFHS-6 anaemia women children", "NFHS-6 antenatal care", "NFHS-6 contraceptive use",
    "NFHS-6 hypertension blood pressure", "NFHS-6 high blood sugar diabetes", "NFHS-6 overweight obesity BMI",
    "NFHS-6 child marriage", "NFHS-6 women empowerment", "NFHS-6 exclusive breastfeeding",
    "NFHS-6 neonatal under-5 mortality", "NFHS-6 crude birth death rate", "NFHS-6 vs NFHS-5 change India",
  ],
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    url: URL,
    title: "NFHS-6 (2023-24) India: Key Indicators & NFHS-5 Comparison",
    description:
      "Full NFHS-6 vs NFHS-5 analysis across 101 indicators — fertility, vaccination, nutrition, maternal care, diabetes and obesity. Plus SRS vital rates.",
    images: [{ url: "/og?title=NFHS-6+%282023-24%29+India+%E2%80%94+Full+Analysis", width: 1200, height: 630, alt: "NFHS-6 2023-24 India Analysis" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NFHS-6 (2023-24) India: Key Indicators & NFHS-5 Comparison",
    description: "What changed from NFHS-5 to NFHS-6 — fertility, vaccination, nutrition, diabetes and obesity, across 101 indicators.",
    images: ["/og?title=NFHS-6+%282023-24%29+India+%E2%80%94+Full+Analysis"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

/* ── colours ── */
const TEAL = "#0d9488";
const TEAL_LT = "#2dd4bf";
const UP_GOOD = "#2dd4bf"; // improvement
const DOWN_BAD = "#f87171"; // worsened
const FLAT = "#64748b";

function trend(row: Indicator) {
  const delta = +(row.n6 - row.n5).toFixed(1);
  if (row.goodWhen === "neutral") return { delta, colour: FLAT, arrow: delta > 0 ? "▲" : delta < 0 ? "▼" : "—" };
  const improved =
    (row.goodWhen === "up" && delta > 0) || (row.goodWhen === "down" && delta < 0);
  const worse = (row.goodWhen === "up" && delta < 0) || (row.goodWhen === "down" && delta > 0);
  return {
    delta,
    colour: delta === 0 ? FLAT : improved ? UP_GOOD : worse ? DOWN_BAD : FLAT,
    arrow: delta > 0 ? "▲" : delta < 0 ? "▼" : "—",
  };
}

export default function NFHS6Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "NFHS-6 (2023-24) India: Key Indicators & NFHS-5 Comparison",
        description:
          "Full NFHS-6 (2023-24) India analysis comparing 101 key indicators with NFHS-5 (2019-21) and SRS vital rates.",
        datePublished: "2026-06-26",
        dateModified: "2026-06-26",
        author: { "@type": "Organization", name: "Vyasa Health", url: "https://health.vyasaa.com" },
        publisher: {
          "@type": "Organization",
          name: "Vyasa Health",
          logo: { "@type": "ImageObject", url: "https://health.vyasaa.com/icons/icon.svg" },
        },
        mainEntityOfPage: URL,
        about: ["NFHS-6", "National Family Health Survey", "India public health", "NFHS-5 comparison"],
      },
      {
        "@type": "Dataset",
        name: "NFHS-6 (2023-24) India Key Indicators vs NFHS-5 (2019-21)",
        description:
          "India national key indicators from the National Family Health Survey, sixth round (2023-24), compared with NFHS-5 (2019-21). Source: IIPS / MoHFW.",
        creator: { "@type": "Organization", name: "International Institute for Population Sciences (IIPS)" },
        license: "https://www.iipsindia.ac.in",
        url: URL,
        temporalCoverage: "2023/2024",
        spatialCoverage: "India",
        keywords: ["NFHS-6", "NFHS-5", "fertility", "vaccination", "nutrition", "maternal health"],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://health.vyasaa.com" },
          { "@type": "ListItem", position: 2, name: "NFHS-6 (2023-24)", item: URL },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", padding: "2.5rem 1.5rem 6rem" }}>
      <JsonLd data={jsonLd} />

      {/* eyebrow */}
      <div style={badge}>
        <span style={badgeTxt}>National Family Health Survey · Round 6</span>
      </div>

      <h1 className="font-display" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 700, color: "#fff", lineHeight: 1.1, marginBottom: "1rem" }}>
        NFHS-6 (2023-24): India Key Indicators &amp; NFHS-5 Comparison
      </h1>
      <p style={{ fontSize: "1.05rem", color: "#94a3b8", lineHeight: 1.8, maxWidth: "760px" }}>
        The <strong style={{ color: "#cbd5e1" }}>National Family Health Survey (NFHS-6), 2023-24</strong> is India&apos;s
        sixth and largest round of population, health and nutrition data, conducted by the
        International Institute for Population Sciences (IIPS) for the Ministry of Health &amp; Family Welfare.
        Below is a complete, indicator-by-indicator comparison of <strong style={{ color: "#cbd5e1" }}>NFHS-6 against NFHS-5 (2019-21)</strong>,
        with SRS vital rates and an analysis of what actually changed.
      </p>

      {/* key facts strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", margin: "2rem 0 0.5rem" }}>
        {[
          ["Released", "May 2026"],
          ["Households", "679,238"],
          ["Women surveyed", "716,397"],
          ["Men surveyed", "100,977"],
          ["States / UTs", "All except Manipur"],
          ["Key indicators", "101"],
        ].map(([k, v]) => (
          <div key={k} style={factCard}>
            <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" }}>{k}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.75rem" }}>
        Fieldwork: two phases, 28 May 2023 – 31 December 2024 · 27 field agencies · First NFHS conducted by IIPS without external technical or financial support.
      </p>

      {/* TL;DR */}
      <h2 style={h2}>The headline shifts, NFHS-5 → NFHS-6</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem", marginTop: "1rem" }}>
        {[
          { t: "Health insurance", a: "41% → 60%", good: true, d: "Biggest single jump — Ayushman Bharat &amp; state schemes." },
          { t: "Women using internet", a: "33% → 64%", good: true, d: "Nearly doubled in four years." },
          { t: "Child stunting", a: "35.5% → 29.3%", good: true, d: "Strongest nutrition gain of the round." },
          { t: "Rotavirus (3 doses)", a: "36% → 85%", good: true, d: "National immunisation rollout." },
          { t: "Caesarean births", a: "21.5% → 27.2%", good: false, d: "Far above the WHO 10–15% norm; 54% in private hospitals." },
          { t: "Adult obesity (women)", a: "24% → 31%", good: false, d: "Diabetes and obesity rising together." },
          { t: "High blood sugar (men)", a: "15.6% → 20.9%", good: false, d: "The NCD warning of NFHS-6." },
          { t: "Spousal violence", a: "29.2% → 22.3%", good: true, d: "Reported gender-based violence fell." },
        ].map((c) => (
          <div key={c.t} style={{ ...factCard, borderColor: c.good ? "#0d948855" : "#7f1d1d66" }}>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600 }}>{c.t}</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: c.good ? UP_GOOD : DOWN_BAD, margin: "4px 0 6px", fontFamily: "'IBM Plex Mono', monospace" }}>{c.a}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: c.d }} />
          </div>
        ))}
      </div>

      {/* SRS vital rates */}
      <h2 style={h2}>Vital rates — SRS (what NFHS doesn&apos;t measure)</h2>
      <p style={p}>
        NFHS-6 does not estimate infant or under-5 mortality in its fact sheet. For those, India&apos;s
        official source is the <strong style={{ color: "#cbd5e1" }}>Sample Registration System (SRS)</strong> of the
        Registrar General of India. Current figures:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
        {SRS.map((s) => (
          <div key={s.label} style={factCard}>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{s.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: TEAL_LT, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: 2 }}>{s.unit}</div>
            <div style={{ fontSize: "0.65rem", color: "#3f4d63", marginTop: 4 }}>{s.src}</div>
          </div>
        ))}
      </div>

      {/* Full comparison tables */}
      <h2 style={h2}>Full India key-indicator comparison</h2>
      <p style={p}>
        Every value is the India total (urban + rural). <span style={{ color: UP_GOOD }}>Teal</span> marks an improvement,
        <span style={{ color: DOWN_BAD }}> red</span> a worsening, and <span style={{ color: FLAT }}>grey</span> a directionally neutral change.
        Percentage-point change shown on the right.
      </p>

      {GROUPS.map((g) => (
        <section key={g.title} style={{ marginTop: "2rem" }}>
          <h3 style={h3}>{g.title}</h3>
          {g.blurb && <p style={{ ...p, marginTop: "0.4rem" }}>{g.blurb}</p>}
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Indicator (%)</th>
                  <th style={th}>NFHS-5<br /><span style={thSub}>2019-21</span></th>
                  <th style={th}>NFHS-6<br /><span style={thSub}>2023-24</span></th>
                  <th style={th}>Change</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((row) => {
                  const t = trend(row);
                  return (
                    <tr key={row.label} style={{ borderTop: "1px solid #16243d" }}>
                      <td style={{ ...td, textAlign: "left" }}>
                        {row.label}
                        {row.note && <span style={{ display: "block", fontSize: "0.72rem", color: "#475569", marginTop: 2 }}>{row.note}</span>}
                      </td>
                      <td style={{ ...td, color: "#94a3b8" }}>{row.n5.toFixed(1)}</td>
                      <td style={{ ...td, color: "#e2e8f0", fontWeight: 700 }}>{row.n6.toFixed(1)}</td>
                      <td style={{ ...td, color: t.colour, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                        {t.arrow} {t.delta > 0 ? "+" : ""}{t.delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p style={{ fontSize: "0.72rem", color: "#475569", marginTop: "1rem" }}>
        * Blood sugar: high or very high (&gt;140 mg/dl) or taking medicine to control blood sugar (random measurement).
        ** Blood pressure: elevated (Systolic ≥140 and/or Diastolic ≥90 mm Hg) or taking medicine.
      </p>

      {/* Analysis */}
      <h2 style={h2}>What NFHS-6 tells us — analysis</h2>

      <Analysis title="Fertility has settled at replacement, and India is ageing">
        India&apos;s Total Fertility Rate held steady at <strong style={cb}>2.0</strong> — unchanged from NFHS-5 and
        at or below the replacement level of 2.1. Urban TFR is 1.6, rural 2.1. Child marriage continued to fall
        (women married before 18: 23.3% → 20.1%), while the share of the population aged 60+ rose from 11.8% to 12.9%.
        The demographic transition is essentially complete; the policy frontier is now ageing, not population growth.
      </Analysis>

      <Analysis title="A digital and financial-inclusion leap">
        The fastest-moving indicators are not clinical at all. Women who have ever used the internet jumped from
        <strong style={cb}> 33.3% to 64.3%</strong>, women with a bank account they use from 78.6% to 89.0%, and any
        household with health insurance from <strong style={cb}>41.0% to 60.2%</strong> — the single biggest gain in
        the survey, driven by Ayushman Bharat and state insurance schemes. These shifts reshape how health services
        are paid for and accessed.
      </Analysis>

      <Analysis title="Maternal care is up — but the caesarean surge is the story">
        Antenatal care improved across the board (4+ visits: 58.5% → 65.2%; first-trimester check-ups: 70% → 76.2%),
        and institutional births rose to 90.6%. But caesarean sections climbed from <strong style={cb}>21.5% to 27.2%</strong>,
        more than double the WHO-recommended 10–15%. In private facilities, <strong style={cb}>54.1%</strong> of births
        are now caesarean. Deliveries are also shifting from public (61.9% → 58.6%) to private hospitals.
      </Analysis>

      <Analysis title="Immunisation is the clearest public-health win">
        Full immunisation of 12–23-month-olds rose from 76.6% to <strong style={cb}>82.6%</strong>. The rotavirus
        vaccine — newly scaled nationally — went from 36.4% to <strong style={cb}>85.4%</strong>, and the second measles
        dose from 58.6% to 71.8%. This is the most unambiguous improvement in NFHS-6.
      </Analysis>

      <Analysis title="The double burden: stunting falls, obesity and diabetes rise">
        Child stunting dropped sharply from 35.5% to <strong style={cb}>29.3%</strong>, severe wasting from 7.7% to 5.2%
        — real progress on under-nutrition. Yet at the same time adult obesity rose (women 24% → 30.7%; men 22.9% → 27.3%)
        and high blood sugar climbed (women 13.5% → 17.8%; men 15.6% → 20.9%). India now carries both malnutrition and a
        fast-growing non-communicable-disease load simultaneously — the defining tension of NFHS-6. One caution: exclusive
        breastfeeding fell (63.7% → 55.8%).
      </Analysis>

      <Analysis title="The contraception paradox">
        Overall contraceptive use rose (66.7% → 69.1%) and unmet need fell — but use of <em>modern</em> methods actually
        declined (56.4% → 52.7%) while traditional methods jumped (10.3% → 16.4%). More couples are spacing births, but a
        growing share rely on less-effective methods, which has implications for unintended pregnancies.
      </Analysis>

      {/* FAQ */}
      <h2 style={h2}>NFHS-6 — frequently asked questions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
        {FAQ.map((f) => (
          <details key={f.q} style={faqCard}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "#e2e8f0", fontSize: "0.95rem", listStyle: "none" }}>
              {f.q}
            </summary>
            <p style={{ marginTop: "0.6rem", color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.7 }}>{f.a}</p>
          </details>
        ))}
      </div>

      {/* internal links + sources */}
      <div style={{ marginTop: "2.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link href="/" style={ctaBtn}>Browse state &amp; district data →</Link>
        <Link href="/sources" style={ctaGhost}>Data sources &amp; methodology</Link>
        <Link href="/idsp" style={ctaGhost}>Live disease surveillance (IDSP)</Link>
      </div>

      <div style={{ marginTop: "2rem", background: "#0f2040", border: "1px solid #1e3a5f", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.6rem" }}>Sources &amp; notes</h3>
        <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.7 }}>
          NFHS-6 and NFHS-5 values are from the <em>National Family Health Survey (NFHS-6), 2023-24: India and State/UT
          Fact Sheets</em>, International Institute for Population Sciences (IIPS) for the Ministry of Health &amp; Family
          Welfare, Government of India (released May 2026). All figures are India totals. Vital rates (IMR, under-5 and
          neonatal mortality, birth and death rates) are from the Sample Registration System (SRS), Registrar General of
          India. Results in the NFHS-6 fact sheets are provisional. This page is an independent analysis for transparency
          and education and is not medical advice.
        </p>
      </div>
    </div>
  );
}

/* ── small server components ── */
function Analysis({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${TEAL}`, paddingLeft: "1.1rem", margin: "1.5rem 0" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ fontSize: "0.94rem", color: "#94a3b8", lineHeight: 1.8 }}>{children}</p>
    </div>
  );
}

/* ── styles ── */
const cb = { color: "#cbd5e1", fontWeight: 700 } as const;
const badge = { display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#0d948820", border: "1px solid #0d948840", borderRadius: 20, padding: "0.3rem 0.85rem", marginBottom: "1.25rem" } as const;
const badgeTxt = { fontSize: "0.72rem", color: "#2dd4bf", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" } as const;
const h2 = { fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 700, color: "#fff", margin: "3rem 0 0.5rem", fontFamily: "'Playfair Display', Georgia, serif" } as const;
const h3 = { fontSize: "1.05rem", fontWeight: 700, color: TEAL_LT, marginBottom: "0.5rem" } as const;
const p = { fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.8, maxWidth: "760px" } as const;
const factCard = { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10, padding: "0.85rem 1rem" } as const;
const tableWrap = { overflowX: "auto" as const, border: "1px solid #1e3a5f", borderRadius: 10, marginTop: "0.85rem" };
const th = { padding: "0.65rem 0.75rem", textAlign: "center" as const, fontSize: "0.74rem", color: "#94a3b8", background: "#0f2040", textTransform: "uppercase" as const, letterSpacing: "0.03em", fontWeight: 600 };
const thSub = { fontSize: "0.65rem", color: "#475569", fontWeight: 400 } as const;
const td = { padding: "0.6rem 0.75rem", textAlign: "center" as const, color: "#cbd5e1" };
const faqCard = { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10, padding: "1rem 1.25rem" } as const;
const ctaBtn = { background: TEAL, color: "#fff", borderRadius: 8, padding: "0.65rem 1.1rem", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" } as const;
const ctaGhost = { background: "#0f2040", border: "1px solid #1e3a5f", color: "#cbd5e1", borderRadius: 8, padding: "0.65rem 1.1rem", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" } as const;
