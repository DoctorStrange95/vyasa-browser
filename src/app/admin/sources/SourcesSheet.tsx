"use client";
import { useEffect, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface PHIRow {
  id?: string; _id?: string;
  type?: string; title?: string; disease?: string; program?: string;
  location?: { state?: string; district?: string };
  cases?: string; deaths?: string; date?: string;
  source?: string; sourceUrl?: string;
  confidence?: string; status?: string; scrapedAt?: string;
}

interface IDSPRow {
  uid?: string; state?: string; district?: string; disease?: string;
  cases?: number; deaths?: number; startDate?: string; reportDate?: string;
  status?: string; week?: number; year?: number;
}

interface SubRow {
  _id?: string; submitterName?: string; submitterEmail?: string;
  state?: string; district?: string;
  fileName?: string; fileType?: string; fileSize?: number;
  extractedData?: string; status?: string; submittedAt?: string;
}

interface FeedbackRow {
  id?: string; mode?: string; type?: string; page?: string;
  message?: string; field?: string;
  currentValue?: string; suggestedValue?: string;
  submitterName?: string; submitterEmail?: string; submitterPhone?: string;
  wantsToJoin?: string; status?: string; timestamp?: string;
  rating?: number; gender?: string; state?: string;
}

interface WaitlistRow {
  _id?: string; name?: string; email?: string; phone?: string;
  role?: string; specialization?: string; city?: string; state?: string;
  facilitySize?: string; opdLoad?: string; currentSystem?: string;
  painPoints?: string[]; interests?: string[];
  status?: string; joinedAt?: string;
}

interface UserRow {
  _id?: string; name?: string; email?: string; phone?: string;
  age?: number; place?: string; authProvider?: string;
  avatar?: string; createdAt?: string; lastLogin?: string;
}

type IDSPWeek = { _id?: string; outbreaks?: IDSPRow[]; week?: number; year?: number; pdfUrl?: string; fetchedAt?: string };

type AllData = {
  phi: PHIRow[];
  idsp: IDSPWeek[];
  submissions: SubRow[];
  feedback: FeedbackRow[];
  waitlist: WaitlistRow[];
  users: UserRow[];
};

/* ── Style helpers ──────────────────────────────────────────────────────── */
const TH: React.CSSProperties = {
  padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.65rem",
  fontWeight: 700, color: "#475569", textTransform: "uppercase",
  letterSpacing: "0.07em", borderBottom: "1px solid #1e3a5f",
  whiteSpace: "nowrap", backgroundColor: "#0a1628", position: "sticky", top: 0,
};
const TD: React.CSSProperties = {
  padding: "0.45rem 0.75rem", fontSize: "0.78rem", color: "#94a3b8",
  borderBottom: "1px solid #0f2040", verticalAlign: "top", maxWidth: "240px",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const PILL = (color: string): React.CSSProperties => ({
  display: "inline-block", padding: "0.1rem 0.45rem", borderRadius: "4px",
  fontSize: "0.62rem", fontWeight: 700, border: `1px solid ${color}50`,
  backgroundColor: `${color}20`, color,
});

const STATUS_COLOR: Record<string, string> = {
  live: "#22c55e", pending: "#eab308", rejected: "#ef4444",
  open: "#eab308", reviewed: "#6366f1", resolved: "#22c55e",
  waitlisted: "#6366f1", approved: "#22c55e",
};

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return s; }
}

function pill(val?: string, map: Record<string, string> = STATUS_COLOR) {
  if (!val) return <span style={{ color: "#334155" }}>—</span>;
  const c = map[val.toLowerCase()] ?? "#94a3b8";
  return <span style={PILL(c)}>{val}</span>;
}

/* ── CSV export ─────────────────────────────────────────────────────────── */
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => escape(r[k])).join(","))].join("\n");
}

function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "phi",         label: "PHI Feed",          icon: "🛰" },
  { id: "idsp",        label: "IDSP Outbreaks",     icon: "🦠" },
  { id: "users",       label: "Registered Users",   icon: "👤" },
  { id: "submissions", label: "Contributions",      icon: "📥" },
  { id: "feedback",    label: "Feedback & Reports", icon: "💬" },
  { id: "waitlist",    label: "Waitlist",            icon: "👥" },
] as const;
type TabId = typeof TABS[number]["id"];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SourcesSheet() {
  const [data,        setData]        = useState<AllData | null>(null);
  const [adminError,  setAdminError]  = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<TabId>("phi");
  const [search,      setSearch]      = useState("");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sources")
      .then(r => r.json())
      .then((d: AllData & { _error?: string }) => {
        if (d._error) setAdminError(d._error);
        const loaded = d as AllData;
        setData(loaded);
        // Default to the most recent week
        if (loaded.idsp?.length) setSelectedWeek(String(loaded.idsp[0]._id ?? ""));
        setLoading(false);
      });
  }, []);

  /* ── active IDSP week ── */
  const activeWeek = (data?.idsp ?? []).find(w => String(w._id) === selectedWeek) ?? data?.idsp?.[0] ?? null;

  /* ── counts for tab badges ── */
  const counts: Record<TabId, number> = {
    phi:         data?.phi.length              ?? 0,
    idsp:        activeWeek?.outbreaks?.length ?? 0,
    users:       data?.users.length            ?? 0,
    submissions: data?.submissions.length      ?? 0,
    feedback:    data?.feedback.length         ?? 0,
    waitlist:    data?.waitlist.length         ?? 0,
  };

  const q = search.toLowerCase();

  function filter<T extends Record<string, unknown>>(rows: T[]): T[] {
    if (!q) return rows;
    return rows.filter(r =>
      Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "1.5rem 1.5rem 4rem" }}>

      {/* Service-account error banner */}
      {adminError && (
        <div style={{ backgroundColor: "#f9731615", border: "1px solid #f9731640", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: "#f97316", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Admin SDK not configured — data cannot be loaded</div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.6 }}>
              Add <code style={{ backgroundColor: "#1e3a5f", borderRadius: "4px", padding: "0.1rem 0.4rem", color: "#2dd4bf" }}>FIREBASE_SERVICE_ACCOUNT_KEY</code> to Vercel environment variables, then redeploy.
              <br />
              <strong style={{ color: "#e2e8f0" }}>Steps:</strong> Firebase Console → Project Settings (⚙️) → Service Accounts → Generate new private key → copy the full JSON → paste as env var value.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>Sources & Data Sheets</h1>
          <p style={{ color: "#475569", fontSize: "0.8rem", marginTop: "0.2rem" }}>All scraped and user-submitted data across Firestore collections</p>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search across sheet…"
          style={{
            backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "8px",
            padding: "0.45rem 0.85rem", color: "#e2e8f0", fontSize: "0.82rem",
            outline: "none", fontFamily: "inherit", width: "220px",
          }}
        />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0", borderBottom: "1px solid #1e3a5f", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); }}
            style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? "#2dd4bf" : "#64748b",
              borderBottom: tab === t.id ? "2px solid #2dd4bf" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: "0.4rem",
              transition: "color 0.15s",
            }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {counts[t.id] > 0 && (
              <span style={{ backgroundColor: tab === t.id ? "#0d948820" : "#1e3a5f", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.65rem", color: tab === t.id ? "#2dd4bf" : "#475569" }}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sheet body */}
      <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#475569" }}>Loading sheets…</div>
        ) : (
          <>
            {tab === "phi"         && <PHISheet         rows={filter((data?.phi ?? []) as Record<string, unknown>[])}         onExport={() => downloadCSV("phi_feed", toPHIExport(data?.phi ?? []))} />}
            {tab === "idsp"        && <IDSPSheet        rows={filter((activeWeek?.outbreaks ?? []) as Record<string, unknown>[])} meta={activeWeek} weeks={data?.idsp ?? []} selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek} onExport={() => downloadCSV(`idsp_outbreaks_w${activeWeek?.week}`, (activeWeek?.outbreaks ?? []) as Record<string, unknown>[])} />}
            {tab === "users"       && <UsersSheet       rows={filter((data?.users ?? []) as Record<string, unknown>[])}          onExport={() => downloadCSV("users", toUsersExport(data?.users ?? []))} />}
            {tab === "submissions" && <SubSheet         rows={filter((data?.submissions ?? []) as Record<string, unknown>[])}    onExport={() => downloadCSV("submissions", toSubExport(data?.submissions ?? []))} />}
            {tab === "feedback"    && <FeedbackSheet    rows={filter((data?.feedback ?? []) as Record<string, unknown>[])}       onExport={() => downloadCSV("feedback", toFeedbackExport(data?.feedback ?? []))} />}
            {tab === "waitlist"    && <WaitlistSheet    rows={filter((data?.waitlist ?? []) as Record<string, unknown>[])}       onExport={() => downloadCSV("waitlist", toWaitlistExport(data?.waitlist ?? []))} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Export flatteners ──────────────────────────────────────────────────── */
function toPHIExport(rows: PHIRow[]): Record<string, unknown>[] {
  return rows.map(r => ({
    id: r.id ?? r._id ?? "",
    type: r.type ?? "",
    title: r.title ?? "",
    disease: r.disease ?? r.program ?? "",
    state: r.location?.state ?? "",
    district: r.location?.district ?? "",
    cases: r.cases ?? "",
    deaths: r.deaths ?? "",
    date: r.date ?? "",
    source: r.source ?? "",
    sourceUrl: r.sourceUrl ?? "",
    confidence: r.confidence ?? "",
    status: r.status ?? "",
    scrapedAt: r.scrapedAt ?? "",
  }));
}

function toSubExport(rows: SubRow[]): Record<string, unknown>[] {
  return rows.map(r => ({
    id: r._id ?? "",
    name: r.submitterName ?? "",
    email: r.submitterEmail ?? "",
    state: r.state ?? "",
    district: r.district ?? "",
    file: r.fileName ?? "",
    type: r.fileType ?? "",
    sizeKB: r.fileSize ? Math.round(r.fileSize / 1024) : "",
    status: r.status ?? "",
    submittedAt: r.submittedAt ?? "",
  }));
}

function toFeedbackExport(rows: FeedbackRow[]): Record<string, unknown>[] {
  return rows.map(r => ({
    id:          r.id ?? "",
    date:        r.timestamp ?? "",
    mode:        r.mode ?? "",
    type:        r.type ?? "",
    page:        r.page ?? "",
    rating:      r.rating ?? "",
    message:     r.message ?? "",
    name:        r.submitterName ?? "",
    email:       r.submitterEmail ?? "",
    phone:       r.submitterPhone ?? "",
    gender:      r.gender ?? "",
    state:       r.state ?? "",
    wantsToJoin: r.wantsToJoin ?? "",
    status:      r.status ?? "",
  }));
}

function toWaitlistExport(rows: WaitlistRow[]): Record<string, unknown>[] {
  return rows.map(r => ({
    id: r._id ?? "",
    name: r.name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    role: r.role ?? "",
    specialization: r.specialization ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    facilitySize: r.facilitySize ?? "",
    opdLoad: r.opdLoad ?? "",
    currentSystem: r.currentSystem ?? "",
    painPoints: (r.painPoints ?? []).join("; "),
    interests: (r.interests ?? []).join("; "),
    status: r.status ?? "",
    joinedAt: r.joinedAt ?? "",
  }));
}

/* ── Sheet header row ───────────────────────────────────────────────────── */
function SheetHeader({ count, onExport }: { count: number; onExport: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: "1px solid #1e3a5f" }}>
      <span style={{ fontSize: "0.75rem", color: "#475569" }}>{count} row{count !== 1 ? "s" : ""}</span>
      <button onClick={onExport}
        style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "0.3rem 0.85rem", color: "#94a3b8", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
        ↓ Export CSV
      </button>
    </div>
  );
}

function EmptyRow() {
  return (
    <tr><td colSpan={20} style={{ ...TD, padding: "3rem", textAlign: "center", color: "#334155" }}>No records found</td></tr>
  );
}

/* ══════════════════════ PHI FEED ══════════════════════════════════════════ */
function PHISheet({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  const typed = rows as PHIRow[];
  const TYPE_C: Record<string, string> = { Outbreak: "#ef4444", Program: "#0d9488", Policy: "#6366f1", Infrastructure: "#eab308" };
  return (
    <>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "90px" }} /><col style={{ width: "80px" }} /><col style={{ width: "280px" }} />
            <col style={{ width: "130px" }} /><col style={{ width: "120px" }} /><col style={{ width: "110px" }} />
            <col style={{ width: "70px" }} /><col style={{ width: "70px" }} /><col style={{ width: "120px" }} />
            <col style={{ width: "80px" }} /><col style={{ width: "80px" }} /><col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr>
              {["Date","Type","Title","Disease / Program","State","District","Cases","Deaths","Source","Confidence","Status","Scraped At"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed.map((r, i) => (
              <tr key={r.id ?? r._id ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                <td style={TD}>{fmtDate(r.date)}</td>
                <td style={TD}><span style={PILL(TYPE_C[r.type ?? ""] ?? "#94a3b8")}>{r.type ?? "—"}</span></td>
                <td style={{ ...TD, whiteSpace: "normal", wordBreak: "break-word" }}>
                  {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none" }}>{r.title ?? "—"}</a> : (r.title ?? "—")}
                </td>
                <td style={TD}>{r.disease ?? r.program ?? "—"}</td>
                <td style={TD}>{r.location?.state ?? "—"}</td>
                <td style={TD}>{r.location?.district ?? "—"}</td>
                <td style={{ ...TD, color: "#fb923c" }}>{r.cases ?? "—"}</td>
                <td style={{ ...TD, color: "#f87171" }}>{r.deaths ?? "—"}</td>
                <td style={TD}>{r.source ?? "—"}</td>
                <td style={TD}>{pill(r.confidence, { High: "#22c55e", Medium: "#fb923c", Low: "#94a3b8" })}</td>
                <td style={TD}>{pill(r.status)}</td>
                <td style={{ ...TD, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem" }}>{fmtDate(r.scrapedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ══════════════════════ IDSP OUTBREAKS ════════════════════════════════════ */
function IDSPSheet({ rows, meta, weeks, selectedWeek, onSelectWeek, onExport }: {
  rows: Record<string, unknown>[];
  meta: IDSPWeek | null;
  weeks: IDSPWeek[];
  selectedWeek: string | null;
  onSelectWeek: (id: string) => void;
  onExport: () => void;
}) {
  const typed = rows as IDSPRow[];
  return (
    <>
      <div style={{ display: "flex", gap: "1rem", padding: "0.65rem 1rem", borderBottom: "1px solid #1e3a5f", flexWrap: "wrap", alignItems: "center" }}>
        {/* Week selector */}
        <select
          value={selectedWeek ?? ""}
          onChange={e => onSelectWeek(e.target.value)}
          style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "6px", color: "#2dd4bf", fontSize: "0.75rem", padding: "0.25rem 0.5rem", fontFamily: "monospace", cursor: "pointer" }}
        >
          {weeks.map(w => (
            <option key={String(w._id)} value={String(w._id)}>
              Week {w.week}/{w.year} — {w.outbreaks?.length ?? 0} outbreaks
            </option>
          ))}
        </select>
        {meta?.pdfUrl && <a href={meta.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: "#2dd4bf" }}>↗ Source PDF</a>}
        {meta?.fetchedAt && <span style={{ fontSize: "0.72rem", color: "#475569" }}>Cached {fmtDate(meta.fetchedAt)}</span>}
      </div>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "180px" }} /><col style={{ width: "130px" }} /><col style={{ width: "130px" }} />
            <col style={{ width: "160px" }} /><col style={{ width: "70px" }} /><col style={{ width: "70px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "110px" }} /><col style={{ width: "130px" }} />
            <col style={{ width: "60px" }} /><col style={{ width: "70px" }} />
          </colgroup>
          <thead>
            <tr>
              {["UID","State","District","Disease","Cases","Deaths","Start Date","Report Date","Status","Week","Year"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed.map((r, i) => (
              <tr key={r.uid ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                <td style={{ ...TD, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "#475569" }}>{r.uid ?? "—"}</td>
                <td style={TD}>{r.state ?? "—"}</td>
                <td style={TD}>{r.district ?? "—"}</td>
                <td style={{ ...TD, color: "#e2e8f0", fontWeight: 500 }}>{r.disease ?? "—"}</td>
                <td style={{ ...TD, color: "#fb923c" }}>{r.cases ?? 0}</td>
                <td style={{ ...TD, color: "#f87171" }}>{r.deaths ?? 0}</td>
                <td style={TD}>{r.startDate ?? "—"}</td>
                <td style={TD}>{r.reportDate ?? "—"}</td>
                <td style={TD}>{pill(r.status, { "under surveillance": "#eab308", "under investigation": "#6366f1", "closed": "#22c55e", "active": "#ef4444" })}</td>
                <td style={{ ...TD, color: "#2dd4bf", fontFamily: "monospace" }}>{r.week ?? "—"}</td>
                <td style={TD}>{r.year ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ══════════════════════ SUBMISSIONS ═══════════════════════════════════════ */
function SubSheet({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  const typed = rows as SubRow[];
  return (
    <>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "110px" }} /><col style={{ width: "130px" }} /><col style={{ width: "160px" }} />
            <col style={{ width: "120px" }} /><col style={{ width: "110px" }} /><col style={{ width: "200px" }} />
            <col style={{ width: "80px" }} /><col style={{ width: "70px" }} /><col style={{ width: "80px" }} />
          </colgroup>
          <thead>
            <tr>
              {["Submitted","Name","Email","State","District","File","Type","Size (KB)","Status"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed.map((r, i) => (
              <tr key={r._id ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                <td style={TD}>{fmtDate(r.submittedAt)}</td>
                <td style={TD}>{r.submitterName ?? "—"}</td>
                <td style={TD}><a href={`mailto:${r.submitterEmail}`} style={{ color: "#2dd4bf", textDecoration: "none" }}>{r.submitterEmail ?? "—"}</a></td>
                <td style={TD}>{r.state ?? "—"}</td>
                <td style={TD}>{r.district ?? "—"}</td>
                <td style={{ ...TD, color: "#e2e8f0" }}>{r.fileName ?? "—"}</td>
                <td style={{ ...TD, fontFamily: "monospace", color: "#475569" }}>{r.fileType ?? "—"}</td>
                <td style={TD}>{r.fileSize ? Math.round(r.fileSize / 1024) : "—"}</td>
                <td style={TD}>{pill(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ══════════════════════ FEEDBACK ══════════════════════════════════════════ */
function FeedbackSheet({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  const typed = rows as FeedbackRow[];
  const MODE_C: Record<string, string> = { feedback: "#6366f1", report: "#ef4444" };
  return (
    <>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "100px" }} /><col style={{ width: "80px" }} /><col style={{ width: "100px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "220px" }} /><col style={{ width: "120px" }} />
            <col style={{ width: "150px" }} /><col style={{ width: "80px" }} /><col style={{ width: "70px" }} />
            <col style={{ width: "80px" }} /><col style={{ width: "80px" }} /><col style={{ width: "80px" }} />
            <col style={{ width: "80px" }} />
          </colgroup>
          <thead>
            <tr>
              {["Date","Mode","Type","Page","Message","Name","Email","Phone","Rating","Gender","State","Wants to Join","Status"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed.map((r, i) => (
              <tr key={r.id ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                <td style={TD}>{fmtDate(r.timestamp)}</td>
                <td style={TD}><span style={PILL(MODE_C[r.mode ?? ""] ?? "#94a3b8")}>{r.mode ?? "—"}</span></td>
                <td style={TD}>{r.type ?? "—"}</td>
                <td style={{ ...TD, color: "#475569" }}>{r.page ?? "—"}</td>
                <td style={{ ...TD, whiteSpace: "normal", wordBreak: "break-word" }}>{r.message ?? "—"}</td>
                <td style={TD}>{r.submitterName ?? "—"}</td>
                <td style={TD}>{r.submitterEmail ? <a href={`mailto:${r.submitterEmail}`} style={{ color: "#2dd4bf", textDecoration: "none" }}>{r.submitterEmail}</a> : "—"}</td>
                <td style={TD}>{r.submitterPhone ?? "—"}</td>
                <td style={{ ...TD, color: "#eab308", fontFamily: "monospace" }}>
                  {r.rating ? "★".repeat(r.rating) : "—"}
                </td>
                <td style={TD}>{r.gender ?? "—"}</td>
                <td style={TD}>{r.state ?? "—"}</td>
                <td style={TD}>{pill(r.wantsToJoin, { yes: "#22c55e", maybe: "#eab308", no: "#94a3b8" })}</td>
                <td style={TD}>{pill(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ══════════════════════ WAITLIST ══════════════════════════════════════════ */
function WaitlistSheet({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  const typed = rows as WaitlistRow[];
  const ROLE_C: Record<string, string> = {
    doctor: "#2dd4bf", nurse: "#6366f1", pharmacist: "#eab308",
    admin: "#94a3b8", researcher: "#818cf8", other: "#475569",
  };
  return (
    <>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "100px" }} /><col style={{ width: "140px" }} /><col style={{ width: "180px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "110px" }} /><col style={{ width: "140px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "110px" }} /><col style={{ width: "110px" }} />
            <col style={{ width: "80px" }} /><col style={{ width: "170px" }} /><col style={{ width: "80px" }} />
          </colgroup>
          <thead>
            <tr>
              {["Joined","Name","Email","Phone","Role","Specialization","City","State","Facility Size","OPD Load","Interests / Pain Points","Status"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed.map((r, i) => (
              <tr key={r._id ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                <td style={TD}>{fmtDate(r.joinedAt)}</td>
                <td style={{ ...TD, color: "#e2e8f0", fontWeight: 500 }}>{r.name ?? "—"}</td>
                <td style={TD}><a href={`mailto:${r.email}`} style={{ color: "#2dd4bf", textDecoration: "none" }}>{r.email ?? "—"}</a></td>
                <td style={TD}>{r.phone ?? "—"}</td>
                <td style={TD}><span style={PILL(ROLE_C[r.role?.toLowerCase() ?? ""] ?? "#94a3b8")}>{r.role ?? "—"}</span></td>
                <td style={TD}>{r.specialization ?? "—"}</td>
                <td style={TD}>{r.city ?? "—"}</td>
                <td style={TD}>{r.state ?? "—"}</td>
                <td style={TD}>{r.facilitySize ?? "—"}</td>
                <td style={TD}>{r.opdLoad ?? "—"}</td>
                <td style={{ ...TD, whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.72rem" }}>
                  {[...(r.interests ?? []), ...(r.painPoints ?? [])].join(", ") || "—"}
                </td>
                <td style={TD}>{pill(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ══════════════════════ REGISTERED USERS ══════════════════════════════════ */
function UsersSheet({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  const typed = rows as UserRow[];
  const AUTH_C: Record<string, string> = { google: "#4285F4", email: "#0d9488", phone: "#eab308" };
  return (
    <>
      <SheetHeader count={typed.length} onExport={onExport} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "110px" }} /><col style={{ width: "160px" }} /><col style={{ width: "200px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "50px" }} /><col style={{ width: "130px" }} />
            <col style={{ width: "110px" }} /><col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr>
              {["Joined","Name","Email","Phone","Age","State","Sign-in Method","Last Login"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typed.length === 0 ? <EmptyRow /> : typed
              .slice()
              .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
              .map((r, i) => (
                <tr key={r._id ?? i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0b1a2e" }}>
                  <td style={TD}>{fmtDate(r.createdAt)}</td>
                  <td style={{ ...TD, color: "#e2e8f0", fontWeight: 500 }}>{r.name ?? "—"}</td>
                  <td style={TD}>
                    {r.email ? <a href={`mailto:${r.email}`} style={{ color: "#2dd4bf", textDecoration: "none" }}>{r.email}</a> : "—"}
                  </td>
                  <td style={TD}>{r.phone ?? "—"}</td>
                  <td style={TD}>{r.age ?? "—"}</td>
                  <td style={TD}>{r.place ?? "—"}</td>
                  <td style={TD}>
                    <span style={PILL(AUTH_C[r.authProvider ?? "email"] ?? "#94a3b8")}>
                      {r.authProvider ?? "email"}
                    </span>
                  </td>
                  <td style={{ ...TD, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem" }}>{fmtDate(r.lastLogin)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function toUsersExport(rows: UserRow[]): Record<string, unknown>[] {
  return rows.map(r => ({
    id:           r._id ?? "",
    name:         r.name ?? "",
    email:        r.email ?? "",
    phone:        r.phone ?? "",
    age:          r.age ?? "",
    state:        r.place ?? "",
    authProvider: r.authProvider ?? "email",
    createdAt:    r.createdAt ?? "",
    lastLogin:    r.lastLogin ?? "",
  }));
}
