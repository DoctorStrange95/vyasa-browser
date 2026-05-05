"use client";
import { useEffect, useState } from "react";
import { fetchPHI } from "@/lib/phiCache";

interface PHItem {
  type: string;
  title: string;
  disease?: string;
  location: { state?: string; district?: string; village?: string };
  summary: string;
  cases?: string | number;
  deaths?: string | number;
  date?: string;
  source: string;
  confidence: "High" | "Medium" | "Low";
  sourceUrl?: string;
}

export default function OutbreakAlerts() {
  const [items, setItems] = useState<PHItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPHI()
      .then(d => {
        const outbreaks: PHItem[] = (d.items ?? []).filter((i: PHItem) => i.type === "Outbreak");
        setItems(outbreaks.slice(0, 8));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Don't render the section at all if no outbreak items
  if (loaded && items.length === 0) return null;

  return (
    <section style={{ backgroundColor: "#0a0e19", borderTop: "1px solid #ef444430", borderBottom: "1px solid #ef444430" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.5rem 1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: loaded && items.length > 0 ? "1rem" : "0" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            backgroundColor: "#ef4444",
            boxShadow: "0 0 8px #ef4444",
            flexShrink: 0,
            animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
            IDSP / IHIP Live Outbreak Alerts
          </span>
          {loaded && items.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#475569" }}>
              {items.length} active alert{items.length !== 1 ? "s" : ""} · IDSP · NHP · PIB
            </span>
          )}
        </div>

        {!loaded && (
          <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ minWidth: "220px", height: "80px", backgroundColor: "#0f2040", borderRadius: "8px", border: "1px solid #1e3a5f", opacity: 0.5, flexShrink: 0 }} />
            ))}
          </div>
        )}

        {loaded && items.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {items.map((item, i) => {
              const stateParts = [item.location.state, item.location.district].filter(Boolean);
              const hasNumbers = (item.cases && item.cases !== "0") || (item.deaths && item.deaths !== "0");
              return (
                <div key={i} style={{
                  minWidth: "230px", maxWidth: "260px", flexShrink: 0,
                  backgroundColor: "#0f0a0a",
                  border: "1px solid #ef444430",
                  borderLeft: "3px solid #ef4444",
                  borderRadius: "8px",
                  padding: "0.75rem 0.9rem",
                  display: "flex", flexDirection: "column", gap: "0.3rem",
                }}>
                  {item.disease && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {item.disease}
                    </span>
                  )}
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#f1f5f9", textDecoration: "none" }}>
                        {item.title.length > 70 ? item.title.slice(0, 68) + "…" : item.title}
                      </a>
                    ) : (
                      item.title.length > 70 ? item.title.slice(0, 68) + "…" : item.title
                    )}
                  </div>
                  {stateParts.length > 0 && (
                    <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>📍 {stateParts.join(", ")}</span>
                  )}
                  {hasNumbers && (
                    <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.65rem" }}>
                      {item.cases && item.cases !== "0" && <span style={{ color: "#fb923c" }}>Cases: <strong>{item.cases}</strong></span>}
                      {item.deaths && item.deaths !== "0" && <span style={{ color: "#f87171" }}>Deaths: <strong>{item.deaths}</strong></span>}
                    </div>
                  )}
                  <span style={{ fontSize: "0.6rem", color: "#374151" }}>{item.source}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
