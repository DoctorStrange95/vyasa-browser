"use client";
import { useState } from "react";

export default function AdminPushSender() {
  const [title, setTitle]   = useState("");
  const [body, setBody]     = useState("");
  const [url, setUrl]       = useState("/");
  const [state, setState]   = useState("");
  const [status, setStatus] = useState<null | { sent: number; failed: number; stale: number }>(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!title.trim() || !body.trim()) { setError("Title and body are required."); return; }
    setLoading(true); setError(""); setStatus(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || "/", stateFilter: state.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send"); return; }
      setStatus({ sent: data.sent, failed: data.failed, stale: data.stale });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#070f1e", border: "1px solid #1e3a5f", borderRadius: "6px",
    color: "#e2e8f0", padding: "0.5rem 0.75rem", fontSize: "0.85rem", outline: "none",
    boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem", display: "block" };

  return (
    <div style={{ marginTop: "1.5rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.25rem" }}>Send Push Notification</div>
      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1.25rem" }}>
        Broadcasts to all subscribed users (or a specific state if filtered).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        <div>
          <label style={lbl}>Title</label>
          <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. IDSP Week 14 — 31 Outbreaks" maxLength={80} />
        </div>
        <div>
          <label style={lbl}>Link URL</label>
          <input style={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="/" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Body</label>
          <textarea style={{ ...inp, resize: "vertical", minHeight: "70px" }} value={body} onChange={e => setBody(e.target.value)} placeholder="e.g. Dengue · Malaria · Scrub Typhus — 18 states reporting." maxLength={200} />
        </div>
        <div>
          <label style={lbl}>State filter (optional)</label>
          <input style={inp} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Maharashtra (leave blank for all)" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            background: loading ? "#1e3a5f" : "#0d9488", color: "#fff", border: "none", borderRadius: "6px",
            padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending…" : "Send Notification"}
        </button>

        {error && <span style={{ fontSize: "0.82rem", color: "#f87171" }}>{error}</span>}

        {status && (
          <span style={{ fontSize: "0.82rem", color: "#4ade80" }}>
            Sent to {status.sent} subscriber{status.sent !== 1 ? "s" : ""}
            {status.failed > 0 ? ` · ${status.failed} failed` : ""}
            {status.stale > 0 ? ` · ${status.stale} stale removed` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
