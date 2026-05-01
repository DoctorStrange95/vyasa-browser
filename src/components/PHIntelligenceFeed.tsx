"use client";
import { useEffect, useState, useCallback, useRef } from "react";

interface PHItem {
  type:      "Outbreak" | "NCD" | "Program" | "Policy" | "Infrastructure";
  category?: "communicable" | "ncd" | "general";
  title:     string;
  disease?:  string;
  program?:  string;
  location:  { state?: string; district?: string; village?: string };
  summary:   string;
  cases?:    string | number;
  deaths?:   string | number;
  date?:     string;
  source:    string;
  sourceUrl?: string;
  confidence: "High" | "Medium" | "Low";
}

interface FeedData {
  refreshedAt:    string | null;
  items:          PHItem[];
  sources:        string[];
  errors:         string[];
  fromCache?:     boolean;
  cacheAgeHours?: number;
}

type Tab = "All" | "Outbreak" | "NCD";
const TABS: Tab[] = ["All", "Outbreak", "NCD"];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Outbreak:       { bg: "#ef444415", border: "#ef444440", text: "#f87171" },
  NCD:            { bg: "#f9731615", border: "#f9731640", text: "#fb923c" },
  Program:        { bg: "#0d948815", border: "#0d948840", text: "#2dd4bf" },
  Policy:         { bg: "#6366f115", border: "#6366f140", text: "#818cf8" },
  Infrastructure: { bg: "#eab30815", border: "#eab30840", text: "#fcd34d" },
};

const CONF_COLORS: Record<string, { bg: string; text: string }> = {
  High:   { bg: "#16a34a20", text: "#4ade80" },
  Medium: { bg: "#d9770620", text: "#fb923c" },
  Low:    { bg: "#64748b20", text: "#94a3b8" },
};

const CATEGORY_ICONS: Record<string, string> = {
  communicable: "🦠",
  ncd:          "🫀",
  general:      "📋",
};

// ── Simple markdown renderer (bold, italic, headers, bullets) ─────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renderMarkdown(text: string): string {
  // Escape first so any raw HTML in LLM output is inert, then apply safe markdown transforms.
  return escHtml(text)
    .replace(/^## (.+)$/gm,   "<h3 style='color:#e2e8f0;font-size:0.9rem;font-weight:700;margin:1rem 0 0.35rem'>$1</h3>")
    .replace(/^### (.+)$/gm,  "<h4 style='color:#cbd5e1;font-size:0.82rem;font-weight:600;margin:0.75rem 0 0.25rem'>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g,"<strong style='color:#e2e8f0'>$1</strong>")
    .replace(/\*(.+?)\*/g,    "<em style='color:#94a3b8'>$1</em>")
    .replace(/^- (.+)$/gm,   "<li style='color:#94a3b8;margin:0.2rem 0 0.2rem 1rem;list-style:disc'>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// ── Summary Modal ─────────────────────────────────────────────────────────────
function SummaryModal({ item, onClose }: { item: PHItem; onClose: () => void }) {
  const [text, setText]     = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const abortRef            = useRef<AbortController | null>(null);
  const tc = TYPE_COLORS[item.type] ?? TYPE_COLORS.Policy;

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch("/api/article-summary", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            title:     item.title,
            summary:   item.summary,
            disease:   item.disease,
            program:   item.program,
            source:    item.source,
            sourceUrl: item.sourceUrl,
            cases:     item.cases,
            deaths:    item.deaths,
            location:  item.location,
            category:  item.category,
            date:      item.date,
            priority:  item.confidence === "High" ? "High" : item.confidence === "Medium" ? "Standard" : "Low",
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          setError(j.error ?? `HTTP ${res.status}`);
          return;
        }

        const reader  = res.body!.getReader();
        const decoder = new TextDecoder();
        let   buf     = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          setText(buf);
        }
        buf += decoder.decode();
        setText(buf);
      } catch (e: unknown) {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Failed to load summary");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [item]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const casesVal  = item.cases  && item.cases  !== "0" ? item.cases  : null;
  const deathsVal = item.deaths && item.deaths !== "0" ? item.deaths : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "#080f1e",
          border: `1px solid ${tc.border}`,
          borderTop: `3px solid ${tc.text}`,
          borderRadius: "14px",
          width: "100%", maxWidth: "720px",
          maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          boxShadow: `0 0 40px ${tc.border}`,
        }}
      >
        {/* Modal header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem", alignItems: "center" }}>
                <span style={{
                  fontSize: "0.63rem", fontWeight: 700,
                  backgroundColor: tc.bg, border: `1px solid ${tc.border}`,
                  color: tc.text, borderRadius: "4px",
                  padding: "0.15rem 0.5rem", letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  {item.category ? CATEGORY_ICONS[item.category] : ""} {item.type}
                </span>
                {(item.disease || item.program) && (
                  <span style={{ fontSize: "0.72rem", color: "#2dd4bf", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {item.disease ?? item.program}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4, margin: 0 }}>
                {item.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "1px solid #1e3a5f", color: "#475569",
                borderRadius: "6px", width: "28px", height: "28px",
                cursor: "pointer", fontSize: "1rem", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>

          {/* Metadata chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
            {[item.location.state, item.location.district].filter(Boolean).map(p => (
              <span key={p} style={{
                fontSize: "0.65rem", backgroundColor: "#0f2040",
                border: "1px solid #1e3a5f", borderRadius: "4px",
                padding: "0.1rem 0.45rem", color: "#94a3b8",
                fontFamily: "'IBM Plex Mono', monospace",
              }}>📍 {p}</span>
            ))}
            {casesVal  && <span style={{ fontSize: "0.65rem", color: "#fb923c", backgroundColor: "#fb923c10", border: "1px solid #fb923c30", borderRadius: "4px", padding: "0.1rem 0.45rem" }}>Cases: <strong>{casesVal}</strong></span>}
            {deathsVal && <span style={{ fontSize: "0.65rem", color: "#f87171", backgroundColor: "#f8717110", border: "1px solid #f8717130", borderRadius: "4px", padding: "0.1rem 0.45rem" }}>Deaths: <strong>{deathsVal}</strong></span>}
            <span style={{ fontSize: "0.6rem", color: "#334155", marginLeft: "auto" }}>{item.source}</span>
          </div>
        </div>

        {/* Summary body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              backgroundColor: loading ? "#2dd4bf" : "#4ade80",
              boxShadow: loading ? "0 0 6px #2dd4bf" : "0 0 6px #4ade80",
              animation: loading ? "pulse 1.5s infinite" : "none",
            }} />
            <span style={{ fontSize: "0.68rem", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
              {loading ? "Analysing with Groq / Llama 3.3…" : "AI Intelligence Briefing"}
            </span>
          </div>

          {error && (
            <div style={{ backgroundColor: "#ef444415", border: "1px solid #ef444440", borderRadius: "8px", padding: "0.75rem 1rem", color: "#f87171", fontSize: "0.8rem" }}>
              {error.includes("GROQ_API_KEY") ? (
                <>
                  <strong>API key not configured.</strong><br />
                  Get a free key at <strong>console.groq.com</strong>, then add <code style={{ backgroundColor: "#0f2040", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>GROQ_API_KEY=…</code> to your <code style={{ backgroundColor: "#0f2040", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>.env.local</code> and restart the dev server.
                </>
              ) : error}
            </div>
          )}

          {!error && (
            <div
              style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: text ? renderMarkdown(text) : "" }}
            />
          )}

          {loading && !text && !error && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[100, 85, 92, 70].map((w, i) => (
                <div key={i} style={{ height: "12px", backgroundColor: "#0f2040", borderRadius: "4px", width: `${w}%`, opacity: 0.5 }} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "0.62rem", color: "#334155" }}>
            Powered by Groq · {item.date ? new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </span>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: "0.72rem", color: "#2dd4bf",
                backgroundColor: "#0d948815", border: "1px solid #0d948840",
                borderRadius: "6px", padding: "0.3rem 0.75rem",
                textDecoration: "none", fontWeight: 600,
              }}
            >
              Read original ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Location chips ─────────────────────────────────────────────────────────────
function LocationChips({ loc }: { loc: PHItem["location"] }) {
  const parts = [loc?.state, loc?.district, loc?.village].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.4rem" }}>
      {parts.map(p => (
        <span key={p} style={{
          fontSize: "0.65rem", backgroundColor: "#0f2040",
          border: "1px solid #1e3a5f", borderRadius: "4px",
          padding: "0.1rem 0.4rem", color: "#94a3b8",
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          📍 {p}
        </span>
      ))}
    </div>
  );
}

// ── Feed item card ─────────────────────────────────────────────────────────────
function ItemCard({ item, onSelect }: { item: PHItem; onSelect: () => void }) {
  const tc  = TYPE_COLORS[item.type]        ?? TYPE_COLORS.Policy;
  const cc  = CONF_COLORS[item.confidence]  ?? CONF_COLORS.Low;
  const icon = item.category ? (CATEGORY_ICONS[item.category] ?? "") : "";
  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const casesVal  = item.cases  != null && item.cases  !== "" && item.cases  !== "0" ? item.cases  : null;
  const deathsVal = item.deaths != null && item.deaths !== "" && item.deaths !== "0" ? item.deaths : null;

  return (
    <div style={{
      backgroundColor: "#0a1628",
      border: "1px solid #1e3a5f",
      borderTop: `2px solid ${tc.border}`,
      borderRadius: "10px",
      padding: "1rem 1.25rem",
      display: "flex", flexDirection: "column", gap: "0.5rem",
      cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
    }}
    onClick={onSelect}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.borderColor = tc.border;
      (e.currentTarget as HTMLDivElement).style.boxShadow  = `0 0 12px ${tc.bg}`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.borderColor = "#1e3a5f";
      (e.currentTarget as HTMLDivElement).style.boxShadow  = "none";
    }}
    >
      {/* Top row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <span style={{
          fontSize: "0.63rem", fontWeight: 700,
          backgroundColor: tc.bg, border: `1px solid ${tc.border}`,
          color: tc.text, borderRadius: "4px",
          padding: "0.15rem 0.5rem", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {icon && `${icon} `}{item.type}
        </span>
        {(item.disease || item.program) && (
          <span style={{ fontSize: "0.7rem", color: "#2dd4bf", fontFamily: "'IBM Plex Mono', monospace" }}>
            {item.disease ?? item.program}
          </span>
        )}
        <span style={{
          marginLeft: "auto", fontSize: "0.6rem",
          backgroundColor: cc.bg, color: cc.text,
          borderRadius: "3px", padding: "0.1rem 0.4rem",
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {item.confidence}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>
        {item.title}
      </div>

      {/* Summary */}
      <div style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6 }}>{cleanSummary(item.summary)}</div>

      {/* Stats */}
      {(casesVal != null || deathsVal != null) && (
        <div style={{ display: "flex", gap: "1rem" }}>
          {casesVal  != null && <span style={{ fontSize: "0.72rem", color: "#fb923c" }}>Cases: <strong>{Number(casesVal).toLocaleString("en-IN")}</strong></span>}
          {deathsVal != null && <span style={{ fontSize: "0.72rem", color: "#f87171" }}>Deaths: <strong>{Number(deathsVal).toLocaleString("en-IN")}</strong></span>}
        </div>
      )}

      <LocationChips loc={item.location} />

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.2rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#475569" }}>{item.source}</span>
        <span style={{ fontSize: "0.62rem", color: "#1e3a5f", fontFamily: "'IBM Plex Mono', monospace" }}>
          Click for AI summary ✦
        </span>
        {dateStr && <span style={{ fontSize: "0.65rem", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{dateStr}</span>}
      </div>
    </div>
  );
}

function cleanSummary(s: string): string {
  return s
    .replace(/[a-z]+\s+href="[^"]*"/gi, "")
    .replace(/href="[^"]*"/gi, "")
    .replace(/target="[^"]*"/gi, "")
    .replace(/oc=\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Session-level cache (5-min TTL — public feed is now a fast Firestore read) ──
const SESSION_KEY    = "ph_feed_v3";
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min — approved items show within 5 min

function getSessionCache(): FeedData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: FeedData; ts: number };
    if (Date.now() - ts > SESSION_TTL_MS) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return data;
  } catch { return null; }
}
function setSessionCache(data: FeedData): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
}

// ── Main feed ─────────────────────────────────────────────────────────────────
export default function PHIntelligenceFeed({ maxItems }: { maxItems?: number } = {}) {
  const [data,      setData]      = useState<FeedData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>("All");
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<PHItem | null>(null);
  const [showAll,   setShowAll]   = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (refresh = false) => {
    // Use session cache on normal loads — only bypass on explicit refresh
    if (!refresh) {
      const cached = getSessionCache();
      if (cached?.items.length) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ph-intelligence${refresh ? "?refresh=1" : ""}`,
        { signal: AbortSignal.timeout(55000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as FeedData;
      setData(d);
      setSessionCache(d);   // store so next navigation uses this
      setRefreshMsg(null);
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "TimeoutError") {
        setRefreshMsg("Refresh running in background — polling for new data…");
        if (pollRef.current) clearInterval(pollRef.current);
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          try {
            const r = await fetch("/api/ph-intelligence");
            if (r.ok) {
              const d = await r.json() as FeedData;
              setData(d);
              setSessionCache(d);
              if (attempts >= 3 || !d.fromCache) {
                clearInterval(pollRef.current!);
                pollRef.current = null;
                setRefreshMsg(null);
              }
            }
          } catch { /* keep polling */ }
          if (attempts >= 8) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setRefreshMsg("Refresh queued — data will update within the hour via cron.");
          }
        }, 10000);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // Sort: Outbreaks first, NCDs second, others last; within each type High confidence first
  const priorityOrder = (i: PHItem) =>
    i.type === "Outbreak" ? 0 : i.type === "NCD" || i.category === "ncd" ? 1 : 2;
  const confOrder = (i: PHItem) =>
    i.confidence === "High" ? 0 : i.confidence === "Medium" ? 1 : 2;

  const sortedItems = [...(data?.items ?? [])].filter(i => i.type !== "Policy").sort((a, b) => {
    const pd = priorityOrder(a) - priorityOrder(b);
    if (pd !== 0) return pd;
    return confOrder(a) - confOrder(b);
  });

  const allFiltered = sortedItems.filter(i => {
    if (tab === "All")      return true;
    if (tab === "Outbreak") return i.type === "Outbreak";
    if (tab === "NCD")      return i.type === "NCD" || i.category === "ncd";
    return true;
  });
  const cap = maxItems && !showAll ? maxItems : undefined;
  const filtered = cap ? allFiltered.slice(0, cap) : allFiltered;

  const counts: Record<Tab, number> = {
    All:      sortedItems.length,
    Outbreak: sortedItems.filter(i => i.type === "Outbreak").length,
    NCD:      sortedItems.filter(i => i.type === "NCD" || i.category === "ncd").length,
  };

  return (
    <>
      {selected && <SummaryModal item={selected} onClose={() => setSelected(null)} />}

      <section style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444", boxShadow: "0 0 6px #ef4444", animation: "pulse 2s infinite" }} />
              <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                Public Health Intelligence
              </h2>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
              Live surveillance — IDSP · IHIP · NCDC · NHP · NCD · NPCDCS · PIB · MoHFW · ICMR &nbsp;·&nbsp;
              <span style={{ color: "#2dd4bf" }}>Click any item for a Groq AI briefing</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {data?.fromCache && (
              <span style={{ fontSize: "0.65rem", color: "#475569", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "0.1rem 0.4rem", fontFamily: "'IBM Plex Mono', monospace" }}>
                cached
              </span>
            )}
            {data?.refreshedAt && (
              <span style={{ fontSize: "0.68rem", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
                {new Date(data.refreshedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => load(true)} disabled={loading}
              style={{ fontSize: "0.75rem", backgroundColor: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "6px", padding: "0.35rem 0.75rem", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Agent legend */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.8rem" }}>🦠</span> IDSP Agent — communicable &amp; infectious diseases
          </span>
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.8rem" }}>🫀</span> NCD Agent — cardiovascular, cancer, diabetes, COPD, CKD, NAFLD
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {TABS.map(t => {
            const active = tab === t;
            const tc     = t === "All" ? null : TYPE_COLORS[t];
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  fontSize: "0.78rem", fontWeight: active ? 700 : 400,
                  backgroundColor: active ? (tc?.bg ?? "#0d948820") : "transparent",
                  border: `1px solid ${active ? (tc?.border ?? "#0d948840") : "#1e3a5f"}`,
                  color:  active ? (tc?.text ?? "#2dd4bf") : "#64748b",
                  borderRadius: "6px", padding: "0.3rem 0.8rem",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}>
                {t === "Outbreak" && "🦠 "}{t === "NCD" && "🫀 "}
                {t}{counts[t] > 0 && <span style={{ opacity: 0.7 }}> ({counts[t]})</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ backgroundColor: "#ef444415", border: "1px solid #ef444440", borderRadius: "8px", padding: "1rem", color: "#f87171", fontSize: "0.82rem", marginBottom: "1rem" }}>
            Could not load feed: {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: "160px", backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "10px", opacity: 0.5 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "3rem", color: "#475569", fontSize: "0.875rem" }}>
            No {tab === "All" ? "" : tab.toLowerCase() + " "}items found.
            {data?.items.length === 0 && " Click ↻ Refresh to fetch live data."}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
              {filtered.map((item, i) => (
                <ItemCard key={i} item={item} onSelect={() => setSelected(item)} />
              ))}
            </div>
            {maxItems && !showAll && allFiltered.length > maxItems && (
              <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
                <button onClick={() => setShowAll(true)} style={{ fontSize: "0.82rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#2dd4bf", borderRadius: "8px", padding: "0.55rem 1.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  View all {allFiltered.length} intelligence items ↓
                </button>
              </div>
            )}
          </>
        )}

        {data?.sources && data.sources.length > 0 && (
          <div style={{ marginTop: "1.5rem", fontSize: "0.68rem", color: "#2d3f55", lineHeight: 1.8 }}>
            <strong style={{ color: "#334155" }}>Data sources:</strong>{" "}
            {data.sources.join(" · ")}
          </div>
        )}
      </section>
    </>
  );
}
