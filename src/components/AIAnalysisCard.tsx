"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  level?: "state" | "district";
  metrics: Record<string, number | null | string | undefined>;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function parseMarkdown(text: string): string {
  // Escape raw HTML before applying markdown transforms so LLM output can't inject scripts.
  return escHtml(text)
    .replace(/^## (.+)$/gm,     '<div style="font-size:0.82rem;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem;margin-top:0.25rem">$1</div>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong style="color:#e2e8f0">$1</strong>')
    .replace(/^- (.+)$/gm,      '<div style="display:flex;gap:0.4rem;margin:0.2rem 0"><span style="color:#2dd4bf;flex-shrink:0">▸</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div style="margin:0.4rem 0"></div>')
    .replace(/\n/g, " ");
}

const RISK_COLORS: Record<string, string> = {
  high: "#ef4444", medium: "#f97316", low: "#22c55e", monitoring: "#eab308",
};

function extractRisk(text: string): string {
  const m = text.match(/Risk level:\s*\*\*([^*]+)\*\*/i);
  return m ? m[1].toLowerCase().trim() : "";
}

export default function AIAnalysisCard({ name, level = "state", metrics }: Props) {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [open,    setOpen]    = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    if (loading || done) return;
    setLoading(true);
    setOpen(true);
    abortRef.current = new AbortController();

    const clean: Record<string, number | null | string> = {};
    for (const [k, v] of Object.entries(metrics)) {
      if (v !== undefined) clean[k] = v as number | null | string;
    }

    try {
      const res = await fetch("/api/state-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, level, metrics: clean }),
        signal: abortRef.current.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done: d, value } = await reader.read();
        if (d) break;
        setText(prev => prev + dec.decode(value));
      }
      setDone(true);
    } catch {
      setText(prev => prev || "*Analysis unavailable. Check Groq API key.*");
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const risk      = extractRisk(text);
  const riskColor = RISK_COLORS[risk] ?? "#eab308";

  return (
    <div style={{ backgroundColor: "#070f1e", border: `1px solid ${done && risk ? riskColor + "60" : "#1e3a5f"}`, borderLeft: `4px solid ${done && risk ? riskColor : "#2dd4bf"}`, borderRadius: "10px", overflow: "hidden", marginBottom: "1.5rem" }}>
      {/* Header row */}
      <div
        onClick={() => { if (!open) { load(); } else { setOpen(false); } }}
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.9rem 1.25rem", cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ fontSize: "1rem" }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2dd4bf", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Analysis</div>
          <div style={{ fontSize: "0.68rem", color: "#334155" }}>Powered by Groq · {name}</div>
        </div>
        {done && risk && (
          <span style={{ fontSize: "0.62rem", backgroundColor: riskColor + "20", color: riskColor, borderRadius: "4px", padding: "0.1rem 0.45rem", fontWeight: 700, textTransform: "capitalize" }}>
            {risk}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); if (!open) load(); else setOpen(false); }}
          style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: "5px" }}
        >
          {open ? "▲" : loading ? "⟳" : "▼ Analyse"}
        </button>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #1e3a5f", padding: "1rem 1.25rem" }}>
          {loading && !text && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", color: "#334155", fontSize: "0.78rem" }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Generating intelligence brief…
            </div>
          )}
          {text && (
            <div
              style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
            />
          )}
          {done && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6rem", color: "#334155" }}>Source: Groq llama-3.3-70b · SRS 2023 + NFHS-6 data</span>
              <button
                onClick={() => { setText(""); setDone(false); load(); }}
                style={{ background: "none", border: "1px solid #1e3a5f", color: "#475569", cursor: "pointer", fontSize: "0.62rem", padding: "0.15rem 0.5rem", borderRadius: "4px" }}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
