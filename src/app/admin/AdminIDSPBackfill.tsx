"use client";
import { useState } from "react";
import Link from "next/link";

export default function AdminIDSPBackfill() {
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [force, setForce] = useState(false);
  const [summary, setSummary] = useState<{ fetched: number; skipped: number; errors: number } | null>(null);

  async function trigger() {
    setStatus("running");
    setLog([]);
    setSummary(null);
    try {
      const res = await fetch("/api/admin/idsp-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, force }),
      });
      const data = await res.json();
      setLog(data.log ?? []);
      setSummary({ fetched: data.fetched ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? 0 });
      setStatus(data.ok ? "ok" : "error");
    } catch (e) {
      setStatus("error");
      setLog([String(e)]);
    }
  }

  const btnColor: Record<typeof status, string> = {
    idle: "#6366f1", running: "#475569", ok: "#16a34a", error: "#dc2626",
  };

  return (
    <div style={{ marginTop: "1.5rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.3rem" }}>
        IDSP Historical Backfill
      </div>
      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem" }}>
        Scrape and store all IDSP weekly PDFs for a given year — populates the heat map and research timeline.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Year</label>
          <input
            type="number"
            value={year}
            min={2022}
            max={new Date().getFullYear()}
            onChange={e => setYear(parseInt(e.target.value))}
            style={{ width: "72px", background: "#070f1e", border: "1px solid #1e3a5f", borderRadius: "5px", color: "#e2e8f0", fontSize: "0.82rem", padding: "0.3rem 0.5rem", fontFamily: "inherit" }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "#94a3b8", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={force}
            onChange={e => setForce(e.target.checked)}
            style={{ accentColor: "#f97316" }}
          />
          Re-fetch existing
        </label>
        <button
          onClick={trigger}
          disabled={status === "running"}
          style={{ backgroundColor: btnColor[status], color: "#fff", border: "none", borderRadius: "7px", padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, cursor: status === "running" ? "wait" : "pointer", fontFamily: "inherit" }}
        >
          {status === "running" ? "Backfilling…" : status === "ok" ? "✓ Done" : status === "error" ? "✗ Failed" : "Run Backfill"}
        </button>
        {summary && (
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            {summary.fetched} fetched · {summary.skipped} skipped · {summary.errors} errors
          </span>
        )}
        {status === "ok" && (
          <Link href="/idsp" style={{ fontSize: "0.78rem", color: "#2dd4bf", textDecoration: "none", fontWeight: 600 }}>
            View IDSP Dashboard ↗
          </Link>
        )}
      </div>

      {log.length > 0 && (
        <div style={{ marginTop: "1rem", background: "#060e1c", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "0.75rem", fontFamily: "monospace", fontSize: "0.72rem", lineHeight: 1.8, maxHeight: "320px", overflowY: "auto" }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: l.startsWith("  ✗") || l.startsWith("✗") ? "#fca5a5" : l.startsWith("⚠") ? "#fbbf24" : l.startsWith("  ✓") || l.startsWith("✓") ? "#4ade80" : "#94a3b8" }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
