import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title  = searchParams.get("title")  ?? "India's Public Health Transparency Platform";
  const sub    = searchParams.get("sub")    ?? "District-level data for 36 states · IMR, disease outbreaks, vaccination, hospitals";
  const state  = searchParams.get("state")  ?? "";
  const metric = searchParams.get("metric") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          display: "flex", flexDirection: "column",
          backgroundColor: "#070f1e",
          fontFamily: "system-ui, sans-serif",
          padding: 0, overflow: "hidden", position: "relative",
        }}
      >
        {/* Grid lines bg */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(#1e3a5f18 1px, transparent 1px), linear-gradient(90deg, #1e3a5f18 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          display: "flex",
        }} />

        {/* Top gradient accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, #0d9488, #6366f1, #2dd4bf)",
          display: "flex",
        }} />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 72px", flex: 1 }}>

          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              backgroundColor: "#0d9488",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: "#fff",
            }}>H</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.2 }}>Vyasa</span>
              <span style={{ fontSize: 12, color: "#475569", letterSpacing: "0.05em" }}>BY VYASA</span>
            </div>
            {state && (
              <div style={{
                marginLeft: 16,
                backgroundColor: "#0d948820",
                border: "1px solid #0d948840",
                borderRadius: 8,
                padding: "4px 14px",
                fontSize: 14, color: "#2dd4bf", fontWeight: 600,
              }}>{state}</div>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: title.length > 50 ? 44 : 54,
            fontWeight: 800,
            color: "#f1f5f9",
            lineHeight: 1.15,
            maxWidth: 900,
            marginBottom: 20,
          }}>{title}</div>

          {/* Sub */}
          <div style={{
            fontSize: 22,
            color: "#64748b",
            lineHeight: 1.5,
            maxWidth: 780,
            marginBottom: "auto",
          }}>{sub}</div>

          {/* Bottom row */}
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 40 }}>
            {(metric
              ? [metric]
              : ["IDSP Surveillance", "NFHS-5 · SRS 2023", "36 States · 700+ Districts"]
            ).map(tag => (
              <div key={tag} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 15, color: "#475569",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#2dd4bf" }} />
                {tag}
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 14, color: "#1e3a5f" }}>vyasaa.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
