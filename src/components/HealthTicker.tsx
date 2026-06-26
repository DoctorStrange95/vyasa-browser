"use client";
import { useEffect, useState } from "react";

interface TickerItem {
  label: string;
  value: string;
  unit: string;
  trend: string;
}

const STATIC_ITEMS: TickerItem[] = [
  { label: "PMJAY Beneficiaries",    value: "550M+",  unit: "",         trend: "" },
  { label: "Blood Banks",            value: "3,859",  unit: "",         trend: "" },
  { label: "Neonatal Mortality",     value: "20",     unit: "/1000 LB", trend: "↓" },
  { label: "Maternal Mortality (SRS 2018–20)", value: "97", unit: "/100k LB", trend: "↓" },
];

export default function HealthTicker() {
  const [liveItems, setLiveItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch("/api/national-ticker")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setLiveItems([
          { label: "National IMR (SRS 2023)",        value: String(d.imr),                    unit: "/1000 LB", trend: "↓" },
          { label: "Rural IMR (SRS 2023)",           value: String(d.imrRural ?? "28"),        unit: "/1000 LB", trend: "↓" },
          { label: "Urban IMR (SRS 2023)",           value: String(d.imrUrban ?? "18"),        unit: "/1000 LB", trend: "↓" },
          { label: "Birth Rate (SRS 2023)",          value: String(d.birthRate ?? "18.4"),     unit: "/1000",    trend: "↓" },
          { label: "Death Rate (SRS 2023)",          value: String(d.deathRate ?? "6.4"),      unit: "/1000",    trend: "↓" },
          { label: "Fully Immunized (NFHS-6)",       value: String(d.vaccinationPct),          unit: "%",        trend: "↑" },
          { label: "Child Stunting (NFHS-6)",        value: String(d.stuntingPct),             unit: "%",        trend: "↓" },
          { label: "Institutional Births (NFHS-6)",  value: String(d.institutionalBirthsPct),  unit: "%",        trend: "↑" },
          { label: "Child Anaemia (NFHS-5)",         value: String(d.anaemiaPct),              unit: "%",        trend: "↓" },
        ]);
      })
      .catch(() => {/* silent fallback to static */});
  }, []);

  const items = [...(liveItems.length ? liveItems : [
    { label: "National IMR (SRS 2020)",  value: "28",   unit: "/1000 LB", trend: "↓" },
    { label: "Under-5 MR (SRS 2020)",   value: "32",   unit: "/1000 LB", trend: "↓" },
    { label: "Fully Immunized (NFHS-6)", value: "82.6", unit: "%",        trend: "↑" },
  ]), ...STATIC_ITEMS];

  const doubled = [...items, ...items];

  return (
    <div style={{ backgroundColor: "#060e1c", borderTop: "1px solid #1e3a5f", borderBottom: "1px solid #1e3a5f", padding: "0.6rem 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          backgroundColor: liveItems.length ? "#0d9488" : "#334155",
          color: "#fff",
          padding: "0.25rem 0.75rem",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          flexShrink: 0,
          fontFamily: "'IBM Plex Mono', monospace",
          zIndex: 10,
          transition: "background 0.5s",
        }}>
          {liveItems.length ? "● LIVE" : "DATA"}
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div className="ticker-track">
            {doubled.map((item, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0 2rem", fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap",
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                <span style={{ color: "#64748b" }}>{item.label}</span>
                <span style={{ color: "#2dd4bf", fontWeight: 600 }}>{item.value}</span>
                {item.unit && <span style={{ color: "#475569" }}>{item.unit}</span>}
                {item.trend && (
                  <span style={{ color: item.trend === "↑" ? "#22c55e" : "#f97316" }}>{item.trend}</span>
                )}
                <span style={{ color: "#1e3a5f", marginLeft: "1rem" }}>|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
