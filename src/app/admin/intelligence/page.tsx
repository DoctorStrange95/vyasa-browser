"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface PHItem {
  _id: string;
  type: "Outbreak" | "NCD" | "Program" | "Policy" | "Infrastructure";
  title: string;
  disease?: string;
  program?: string;
  location: { state: string; district: string; village: string };
  summary: string;
  cases?: string;
  deaths?: string;
  date?: string;
  source: string;
  confidence: "High" | "Medium" | "Low";
  status: "pending" | "live" | "rejected";
  scrapedAt?: string;
}

const TYPE_COLORS: Record<string, string> = {
  Outbreak: "#ef4444", NCD: "#818cf8", Program: "#0d9488", Infrastructure: "#eab308",
};

function cleanSummary(s: string): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\ba\s+href=["'][^"']*["']/gi, "")
    .replace(/\bhref=["'][^"']*["']/gi, "")
    .replace(/\btarget=["'][^"']*["']/gi, "")
    .replace(/\brel=["'][^"']*["']/gi, "")
    .replace(/\boc=\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CONF_COLORS: Record<string, string> = { High: "#4ade80", Medium: "#fb923c", Low: "#94a3b8" };

function categoryBreakdown(items: PHItem[]) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;
  return counts;
}

function lastScrapeTime(items: PHItem[]): string | null {
  const times = items.map(i => i.scrapedAt).filter(Boolean) as string[];
  if (!times.length) return null;
  return times.sort().at(-1) ?? null;
}

export default function IntelligenceAdmin() {
  const [data, setData] = useState<{ pending: PHItem[]; liveCount: number; rejectedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [noFirebase, setNoFirebase] = useState(false);
  const [approveAllLoading, setApproveAllLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/ph-intelligence");
    const json = await res.json();
    if (json.error === "Firebase not configured") { setNoFirebase(true); setLoading(false); return; }
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    await fetch("/api/admin/ph-intelligence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setActing(null);
    await load();
  }

  async function approveAll() {
    setApproveAllLoading(true);
    await fetch("/api/admin/ph-intelligence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_all" }),
    });
    setApproveAllLoading(false);
    await load();
  }

  // Strip Policy items — not shown in review queue or live feed
  const visiblePending = (data?.pending ?? []).filter(i => i.type !== "Policy");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e", padding: "0" }}>
      <style>{`
        @media (max-width: 640px) {
          .phi-top-bar { padding: 0 1rem !important; }
          .phi-inner { padding: 1.25rem 1rem !important; }
          .phi-card { flex-direction: column !important; }
          .phi-card-actions { flex-direction: row !important; gap: 0.5rem !important; }
          .phi-card-actions button { flex: 1; }
          .phi-filter-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap !important; }
          .phi-filter-scroll::-webkit-scrollbar { display: none; }
          .phi-last-scraped { display: none !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="phi-top-bar" style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 2rem", height: "60px", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/admin" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.82rem" }}>← Dashboard</Link>
        <span style={{ color: "#fff", fontWeight: 700 }}>PH Intelligence Review</span>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#0d9488", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
          {data ? `${data.liveCount} live · ${data.rejectedCount} rejected` : ""}
        </span>
      </div>

      <div className="phi-inner admin-inner-wrap" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 2rem" }}>

        {noFirebase && (
          <div style={{ backgroundColor: "#eab30820", border: "1px solid #eab30840", borderRadius: "10px", padding: "1.5rem", color: "#fcd34d", marginBottom: "2rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Firebase not configured</div>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
              Add <code style={{ backgroundColor: "#0a1628", padding: "0 0.3rem", borderRadius: "3px" }}>FIREBASE_PROJECT_ID</code>,{" "}
              <code style={{ backgroundColor: "#0a1628", padding: "0 0.3rem", borderRadius: "3px" }}>FIREBASE_CLIENT_EMAIL</code>, and{" "}
              <code style={{ backgroundColor: "#0a1628", padding: "0 0.3rem", borderRadius: "3px" }}>FIREBASE_PRIVATE_KEY</code> to your Vercel environment variables. See setup guide below.
            </p>
          </div>
        )}

        {!noFirebase && (
          <>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                  Pending Items {data && <span style={{ color: "#64748b", fontSize: "1rem" }}>({visiblePending.length})</span>}
                </h1>
                <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                  Review scraped intelligence before it goes live on the homepage
                </p>
              </div>
              {visiblePending.length > 0 && (
                <button onClick={approveAll} disabled={approveAllLoading}
                  style={{ backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "7px", padding: "0.55rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, cursor: approveAllLoading ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {approveAllLoading ? "Approving…" : `✓ Approve All (${activeFilter === "All" ? visiblePending.length : visiblePending.filter(i => i.type === activeFilter).length})`}
                </button>
              )}
            </div>

            {/* Filter tabs — category breakdown */}
            {visiblePending.length > 0 && (() => {
              const breakdown = categoryBreakdown(visiblePending);
              const lastAt    = lastScrapeTime(visiblePending);
              const allTypes  = ["All", ...Object.keys(breakdown)];
              return (
                <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.75rem 1.25rem", marginBottom: "1.5rem" }}>
                  <div className="phi-filter-scroll" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.65rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "0.25rem", flexShrink: 0 }}>Filter</span>
                    {allTypes.map(type => {
                      const color  = TYPE_COLORS[type] ?? "#64748b";
                      const active = activeFilter === type;
                      const count  = type === "All" ? visiblePending.length : (breakdown[type] ?? 0);
                      return (
                        <button key={type} onClick={() => setActiveFilter(type)}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0,
                            backgroundColor: active ? `${color}20` : "transparent",
                            border: `1px solid ${active ? color : "#1e3a5f"}`,
                            borderRadius: "20px", padding: "0.25rem 0.75rem",
                            cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                          }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: active ? color : "#475569", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.72rem", color: active ? color : "#94a3b8", fontWeight: active ? 700 : 400 }}>{type}</span>
                          <span style={{ fontSize: "0.68rem", color: active ? color : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{count}</span>
                        </button>
                      );
                    })}
                    {lastAt && (
                      <span className="phi-last-scraped" style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#334155", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                        Last scraped: {new Date(lastAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {loading && (
              <div style={{ color: "#475569", fontSize: "0.85rem" }}>Loading pending items…</div>
            )}

            {!loading && visiblePending.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: "#475569", backgroundColor: "#0f2040", borderRadius: "10px", border: "1px solid #1e3a5f" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
                <div>No pending items. All caught up.</div>
                <div style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
                  Run a <Link href="/admin/data" style={{ color: "#2dd4bf" }}>PH Intelligence refresh</Link> to fetch new data.
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {visiblePending
                .filter(item => activeFilter === "All" || item.type === activeFilter)
                .map(item => (
                <div key={item._id} className="phi-card" style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, backgroundColor: `${TYPE_COLORS[item.type] ?? "#64748b"}20`, border: `1px solid ${TYPE_COLORS[item.type] ?? "#64748b"}50`, color: TYPE_COLORS[item.type] ?? "#64748b", borderRadius: "4px", padding: "0.1rem 0.45rem", textTransform: "uppercase", flexShrink: 0 }}>
                        {item.type}
                      </span>
                      {item.disease && <span style={{ fontSize: "0.7rem", color: "#2dd4bf", fontFamily: "'IBM Plex Mono', monospace" }}>{item.disease}</span>}
                      {item.program && <span style={{ fontSize: "0.7rem", color: "#818cf8", fontFamily: "'IBM Plex Mono', monospace" }}>{item.program}</span>}
                      <span style={{ fontSize: "0.6rem", color: CONF_COLORS[item.confidence], marginLeft: "auto", whiteSpace: "nowrap" }}>{item.confidence} confidence</span>
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.3rem", wordBreak: "break-word" }}>{item.title}</div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "0.4rem", wordBreak: "break-word", overflowWrap: "break-word" }}>{cleanSummary(item.summary)}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.68rem", color: "#475569" }}>
                      {item.location.state && <span>📍 {item.location.state}{item.location.district ? `, ${item.location.district}` : ""}</span>}
                      {item.cases && <span style={{ color: "#fb923c" }}>Cases: {item.cases}</span>}
                      {item.deaths && <span style={{ color: "#f87171" }}>Deaths: {item.deaths}</span>}
                      <span style={{ wordBreak: "break-all" }}>{item.source}</span>
                      {item.date && <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{item.date}</span>}
                    </div>
                  </div>
                  <div className="phi-card-actions" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
                    <button onClick={() => act(item._id, "approve")} disabled={acting === item._id}
                      style={{ backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", padding: "0.4rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: acting === item._id ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {acting === item._id ? "…" : "✓ Approve"}
                    </button>
                    <button onClick={() => act(item._id, "reject")} disabled={acting === item._id}
                      style={{ backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef444440", borderRadius: "6px", padding: "0.4rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: acting === item._id ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Firebase setup guide */}
        <div style={{ marginTop: "3rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>Firebase Setup (one-time)</div>
          <ol style={{ color: "#94a3b8", fontSize: "0.82rem", lineHeight: 2, paddingLeft: "1.25rem", margin: 0 }}>
            <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2dd4bf" }}>console.firebase.google.com</a> → Create a project named <strong style={{ color: "#e2e8f0" }}>healthforindia</strong></li>
            <li>Enable <strong style={{ color: "#e2e8f0" }}>Firestore Database</strong> (Start in production mode)</li>
            <li>Go to <strong style={{ color: "#e2e8f0" }}>Project Settings → Service Accounts → Generate new private key</strong> → Download JSON</li>
            <li>In <strong style={{ color: "#e2e8f0" }}>Vercel → Settings → Environment Variables</strong>, add:<br />
              <code style={{ backgroundColor: "#070f1e", padding: "0.1rem 0.35rem", borderRadius: "3px", display: "inline-block", marginTop: "0.25rem" }}>FIREBASE_PROJECT_ID</code> = <em>your-project-id from the JSON</em><br />
              <code style={{ backgroundColor: "#070f1e", padding: "0.1rem 0.35rem", borderRadius: "3px", display: "inline-block" }}>FIREBASE_CLIENT_EMAIL</code> = <em>client_email from the JSON</em><br />
              <code style={{ backgroundColor: "#070f1e", padding: "0.1rem 0.35rem", borderRadius: "3px", display: "inline-block" }}>FIREBASE_PRIVATE_KEY</code> = <em>private_key from the JSON (the full -----BEGIN … -----END----- string)</em>
            </li>
            <li>Redeploy on Vercel, then come back here and trigger a <Link href="/admin/data" style={{ color: "#2dd4bf" }}>PH Intelligence refresh</Link></li>
          </ol>
        </div>
      </div>
    </div>
  );
}
