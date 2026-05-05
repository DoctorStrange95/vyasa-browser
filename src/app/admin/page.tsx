import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminLogout from "./AdminLogout";
import AdminRefreshButton from "./AdminRefreshButton";
import AdminPushSender from "./AdminPushSender";
import VyasaLogo from "@/components/VyasaLogo";
import { getAdminDb } from "@/lib/firestore-admin";
import { readFile } from "fs/promises";
import path from "path";

const MENU = [
  { href: "/admin/analytics",    icon: "📈", label: "Site Analytics",          desc: "Page views, daily traffic chart and top pages for the last 14 days" },
  { href: "/admin/ui-settings",  icon: "🎛️", label: "UI Visibility Settings",   desc: "Show/hide header buttons, sidebar sections, mobile FAB, content tabs" },
  { href: "/admin/sources",      icon: "🗂", label: "Sources & Data Sheets",  desc: "All scraped and user-submitted data in tabbed spreadsheet view" },
  { href: "/admin/submissions",  icon: "📥", label: "Community Submissions",  desc: "Review AI-extracted health data uploaded by users" },
  { href: "/admin/intelligence", icon: "🛰", label: "Intelligence Review",    desc: "Approve or reject scraped PH alerts before they go live" },
  { href: "/admin/feedback",     icon: "💬", label: "Feedback & Reports",     desc: "View data correction requests and user reports" },
  { href: "/admin/hospitals",    icon: "🏥", label: "Manage Health Centres",  desc: "Add PHCs, CHCs, hospitals with address & services" },
  { href: "/admin/data",         icon: "📊", label: "Upload Health Data",     desc: "Update state/district statistics before going live" },
  { href: "/admin/contributors", icon: "👥", label: "Contributors & Sponsors", desc: "Manage data authors, sponsors, acknowledgements" },
  { href: "/admin/team",         icon: "👤", label: "Team Page Editor",        desc: "Edit team members, founder bio, timeline, photos & CTA" },
  { href: "/sources",            icon: "📚", label: "Data Sources (public)",   desc: "View live public-facing data sources page" },
  { href: "/",                   icon: "🌐", label: "View Live Site",          desc: "Open the public-facing Vyasa portal" },
];

async function fetchSiteStats() {
  try {
    const db = getAdminDb();

    const [usersSnap, waitlistSnap, feedbackDoc] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("waitlist").count().get(),
      db.collection("feedback").doc("all").get(),
    ]);

    const userCount     = usersSnap.data().count;
    const waitlistCount = waitlistSnap.data().count;

    let openFeedback = 0;
    if (feedbackDoc.exists) {
      const items = (feedbackDoc.data()?.items ?? []) as Array<{ status: string }>;
      openFeedback = items.filter(i => i.status === "open").length;
    }

    // Page views — today + last 7 days
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10).replace(/-/g, "");
    });

    const pvDocs = await Promise.all(
      days.map(d => db.collection("analytics").doc(`pv_${d}`).get()),
    );

    const todayViews = pvDocs[0].exists ? ((pvDocs[0].data()?.views as number) ?? 0) : 0;
    const weekViews  = pvDocs.reduce((sum, doc) =>
      sum + (doc.exists ? ((doc.data()?.views as number) ?? 0) : 0), 0);

    // Last refresh time from IDSP cache
    let lastRefresh = "Never";
    try {
      const IDSP_TMP = "/tmp/idsp-cache.json";
      const IDSP_DEFAULT = path.join(process.cwd(), "src/data/idsp-cache.json");
      let raw = "";
      try { raw = await readFile(IDSP_TMP, "utf-8"); }
      catch { raw = await readFile(IDSP_DEFAULT, "utf-8"); }
      const cache = JSON.parse(raw);
      if (cache.refreshedAt) {
        const d = new Date(cache.refreshedAt);
        lastRefresh = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      }
    } catch { /* no cache yet */ }

    return { userCount, waitlistCount, openFeedback, todayViews, weekViews, lastRefresh };
  } catch {
    return { userCount: 0, waitlistCount: 0, openFeedback: 0, todayViews: 0, weekViews: 0, lastRefresh: "Unknown" };
  }
}

export default async function AdminDashboard() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect("/admin/login");

  const { userCount, waitlistCount, openFeedback, todayViews, weekViews, lastRefresh } = await fetchSiteStats();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e", padding: "0" }}>
      {/* Top bar */}
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 2rem", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <VyasaLogo size={32} />
          <span className="font-display" style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Admin Panel</span>
          <span style={{ backgroundColor: "#0d948820", border: "1px solid #0d948840", borderRadius: "4px", padding: "0.1rem 0.5rem", fontSize: "0.65rem", color: "#2dd4bf", fontFamily: "'IBM Plex Mono', monospace" }}>MASTER</span>
        </div>
        <AdminLogout />
      </div>

      <div className="admin-inner-wrap" style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 2rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
            Dashboard
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.88rem" }}>
            Manage Vyasa data, feedback, health centres and contributors.
          </p>
        </div>

        {/* Site Activity — live stats */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "0.75rem" }}>Site Activity</div>
          <div className="admin-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {[
              { label: "Registered Users",   value: userCount.toString(),     color: "#2dd4bf", icon: "👤", href: "/admin/sources" },
              { label: "Waitlist Signups",    value: waitlistCount.toString(), color: "#6366f1", icon: "📋", href: "/admin/sources" },
              { label: "Open Feedback",       value: openFeedback.toString(),  color: openFeedback > 0 ? "#f97316" : "#22c55e", icon: "💬", href: "/admin/feedback" },
              { label: "Views Today",         value: todayViews.toString(),    color: "#38bdf8", icon: "👁", href: "/admin/analytics" },
              { label: "Views (7 days)",      value: weekViews.toString(),     color: "#a78bfa", icon: "📈", href: "/admin/analytics" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="admin-stat-card" style={{ textDecoration: "none", display: "block" }}>
                <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    <span style={{ marginRight: "0.35rem" }}>{s.icon}</span>{s.label}
                  </div>
                  <div className="font-data" style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Data coverage stats */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "0.75rem" }}>Data Coverage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
            {[
              { label: "States covered",   value: "36",                                  color: "#2dd4bf" },
              { label: "Cities monitored", value: "213",                                color: "#2dd4bf" },
              { label: "Data sources",     value: "IDSP · CPCB · SRS · NHP · PHI",    color: "#6366f1" },
              { label: "Last refresh",     value: lastRefresh,                          color: "#eab308" },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.3rem" }}>{s.label}</div>
                <div className="font-data" style={{ fontSize: s.value.length > 8 ? "0.82rem" : "1.4rem", fontWeight: 600, color: s.color, lineHeight: 1.4 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div className="admin-menu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <div className="admin-menu-card">
                <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{item.icon}</div>
                <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "1rem", marginBottom: "0.3rem" }}>{item.label}</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Cron status */}
        <div style={{ marginTop: "2.5rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.25rem" }}>Daily Data Refresh</div>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Runs at 02:00 UTC daily via Vercel Cron · Refreshes AQI, PHC/CHC counts, checks data.gov.in for updates
              </div>
            </div>
            <AdminRefreshButton />
          </div>
        </div>

        <AdminPushSender />
      </div>
    </div>
  );
}
