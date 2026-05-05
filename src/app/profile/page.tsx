"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import VyasaLogo from "@/components/VyasaLogo";
import SymptomReporter from "@/components/SymptomReporter";
import PushNotificationSetup from "@/components/PushNotificationSetup";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserProfile { name: string; email: string; phone: string; place: string; age: number | null; }
interface Submission  {
  _id: string; fileName: string; state: string; district?: string;
  status: string; submittedAt: string; rejectionReason?: string;
  extractedData?: string;
}

type Tab = "overview" | "edit" | "password" | "submissions" | "symptoms" | "feedback";

// ── Helpers ──────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", background: "#0d1f3c", border: "1px solid #1e3a5f",
  borderRadius: "7px", color: "#e2e8f0", fontSize: "0.9rem",
  padding: "0.5rem 0.8rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontSize: "0.7rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.3rem" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "0.9rem" }}><label style={lbl}>{label}</label>{children}</div>;
}

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: type === "ok" ? "#166534" : "#7f1d1d", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "8px", fontSize: "0.85rem", maxWidth: "340px", boxShadow: "0 4px 12px #0008" }}>
      {msg}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const VALID_TABS: Tab[] = ["overview", "edit", "password", "submissions", "symptoms", "feedback"];

export default function ProfilePage() {
  return <Suspense fallback={null}><ProfilePageInner /></Suspense>;
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") ?? "overview") as Tab;
  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [subs,      setSubs]      = useState<Submission[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>(VALID_TABS.includes(initialTab) ? initialTab : "overview");
  const [toast,     setToast]     = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Edit form state
  const [editForm,  setEditForm]  = useState({ name: "", phone: "", place: "", age: "" });
  const [saving,    setSaving]    = useState(false);

  // Password form state
  const [pwForm,    setPwForm]    = useState({ current: "", next: "", confirm: "" });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [showPw,    setShowPw]    = useState({ current: false, next: false, confirm: false });

  // Feedback form state
  const [fbType,    setFbType]    = useState("general");
  const [fbMsg,     setFbMsg]     = useState("");
  const [fbSaving,  setFbSaving]  = useState(false);
  const [fbDone,    setFbDone]    = useState(false);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/citizens/me").then(r => r.ok ? r.json() : null),
      fetch("/api/profile/submissions").then(r => r.ok ? r.json() : { submissions: [] }),
    ]).then(([prof, subData]) => {
      if (!prof || prof.error) { router.replace("/auth?next=/profile"); return; }
      setProfile(prof);
      setEditForm({ name: prof.name, phone: prof.phone ?? "", place: prof.place ?? "", age: prof.age ? String(prof.age) : "" });
      setSubs(subData.submissions ?? []);
    }).catch(() => router.replace("/auth?next=/profile"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/citizens/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error ?? "Update failed.", "err"); return; }
      setProfile(p => p ? { ...p, ...editForm, age: editForm.age ? Number(editForm.age) : null } : p);
      showToast("Profile updated successfully.");
    } catch { showToast("Update failed.", "err"); }
    finally { setSaving(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { showToast("New passwords do not match.", "err"); return; }
    if (pwForm.next.length < 8)         { showToast("New password must be at least 8 characters.", "err"); return; }
    setPwSaving(true);
    try {
      const r = await fetch("/api/auth/user/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error ?? "Password change failed.", "err"); return; }
      setPwForm({ current: "", next: "", confirm: "" });
      showToast("Password changed successfully.");
    } catch { showToast("Password change failed.", "err"); }
    finally { setPwSaving(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/user/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      Loading…
    </div>
  );

  if (!profile) return null;

  const approved = subs.filter(s => s.status === "approved").length;
  const pending  = subs.filter(s => s.status === "pending").length;

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",     label: "Overview" },
    { id: "symptoms",     label: "🩺 Report Symptoms" },
    { id: "feedback",     label: "💬 Feedback" },
    { id: "edit",         label: "Edit Profile" },
    { id: "password",     label: "Change Password" },
    { id: "submissions",  label: `Submissions${subs.length ? ` (${subs.length})` : ""}` },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Nav */}
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 1.5rem", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <VyasaLogo size={28} />
          <span className="font-display" style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Vyasa</span>
        </Link>
        <button onClick={handleLogout} style={{ background: "transparent", color: "#64748b", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer" }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* ── Profile hero card ── */}
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#0d948830", border: "2px solid #0d948860", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", fontWeight: 700, color: "#2dd4bf", flexShrink: 0 }}>
              {profile.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>{profile.name}</div>
              <div style={{ fontSize: "0.78rem", color: "#475569" }}>{profile.email}</div>
              {profile.phone && <div style={{ fontSize: "0.72rem", color: "#334155", marginTop: "0.1rem" }}>📱 {profile.phone}</div>}
              {profile.place && <div style={{ fontSize: "0.72rem", color: "#334155", marginTop: "0.1rem" }}>📍 {profile.place}</div>}
            </div>
            <button onClick={() => setTab("edit")} style={{ background: "#0f2040", border: "1px solid #1e3a5f", color: "#64748b", borderRadius: "7px", padding: "0.35rem 0.85rem", fontSize: "0.78rem", cursor: "pointer", flexShrink: 0 }}>
              ✏️ Edit
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { label: "Submissions", value: subs.length, color: "#2dd4bf" },
              { label: "Approved",    value: approved,    color: "#22c55e" },
              { label: "Pending",     value: pending,     color: "#eab308" },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: "#080f1e", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.85rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: "0.62rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Citizens Centre CTA ── */}
        <Link href="/citizens" style={{ display: "flex", alignItems: "center", gap: "1rem", textDecoration: "none", backgroundColor: "#071a10", border: "1px solid #14532d", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "2rem", flexShrink: 0 }}>🏥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#86efac", fontSize: "0.92rem" }}>Citizens Health Centre</div>
            <div style={{ fontSize: "0.75rem", color: "#4ade8066", marginTop: "0.1rem" }}>Find Ayushman hospitals · State health stats · Your health locker</div>
          </div>
          <div style={{ color: "#22c55e", fontSize: "1.1rem", flexShrink: 0 }}>→</div>
        </Link>

        {/* ── Quick links ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <Link href="/contribute" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", backgroundColor: "#0d9488", color: "#fff", textDecoration: "none", borderRadius: "9px", padding: "0.75rem", fontWeight: 700, fontSize: "0.88rem" }}>
            📎 Submit Data
          </Link>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", textDecoration: "none", borderRadius: "9px", padding: "0.75rem", fontWeight: 600, fontSize: "0.88rem" }}>
            🌐 View Health Map
          </Link>
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: "1px solid #1e3a5f", display: "flex", marginBottom: "1.5rem", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "0.7rem 1.1rem", border: "none", background: "transparent",
              color: tab === t.id ? "#93c5fd" : "#64748b",
              borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              fontWeight: tab === t.id ? 600 : 400, fontSize: "0.85rem",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>Account Details</div>
            {[
              { label: "Full Name",   value: profile.name },
              { label: "Email",       value: profile.email },
              { label: "Phone",       value: profile.phone || "—" },
              { label: "Location",    value: profile.place || "—" },
              { label: "Age",         value: profile.age ? `${profile.age} years` : "—" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", gap: "1rem", paddingBottom: "0.65rem", marginBottom: "0.65rem", borderBottom: "1px solid #0f1e35" }}>
                <div style={{ fontSize: "0.78rem", color: "#475569", minWidth: "110px", flexShrink: 0 }}>{r.label}</div>
                <div style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>{r.value}</div>
              </div>
            ))}
            <button onClick={() => setTab("edit")} style={{ marginTop: "0.5rem", background: "#0f2040", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: "7px", padding: "0.45rem 1rem", fontSize: "0.82rem", cursor: "pointer" }}>
              ✏️ Edit profile
            </button>
          </div>
        )}

        {/* ── Edit Profile ── */}
        {tab === "edit" && (
          <form onSubmit={handleSaveProfile} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>Edit Profile</div>
            <Field label="Full Name">
              <input style={inp} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" required />
            </Field>
            <Field label="Phone Number">
              <input style={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" type="tel" />
            </Field>
            <Field label="City / District / Place">
              <input style={inp} value={editForm.place} onChange={e => setEditForm(f => ({ ...f, place: e.target.value }))} placeholder="e.g. Patna, Bihar" />
            </Field>
            <Field label="Age">
              <input style={inp} value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} placeholder="Your age" type="number" min={1} max={120} />
            </Field>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="submit" disabled={saving} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: "8px", padding: "0.55rem 1.5rem", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: "0.88rem" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={() => setTab("overview")} style={{ background: "transparent", color: "#475569", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.55rem 1rem", cursor: "pointer", fontSize: "0.88rem" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Change Password ── */}
        {tab === "password" && (
          <form onSubmit={handleChangePassword} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>Change Password</div>

            {(["current", "next", "confirm"] as const).map((key, i) => (
              <Field key={key} label={i === 0 ? "Current Password" : i === 1 ? "New Password" : "Confirm New Password"}>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...inp, paddingRight: "2.5rem" }}
                    type={showPw[key] ? "text" : "password"}
                    value={pwForm[key]}
                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={i === 0 ? "Enter current password" : i === 1 ? "Min. 8 characters" : "Repeat new password"}
                    required
                  />
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                    style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.85rem" }}>
                    {showPw[key] ? "🙈" : "👁"}
                  </button>
                </div>
              </Field>
            ))}

            <div style={{ marginTop: "0.25rem" }}>
              <button type="submit" disabled={pwSaving} style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "0.55rem 1.5rem", fontWeight: 700, cursor: pwSaving ? "wait" : "pointer", fontSize: "0.88rem" }}>
                {pwSaving ? "Changing…" : "Change Password"}
              </button>
            </div>
          </form>
        )}

        {/* ── Symptoms ── */}
        {tab === "symptoms" && (
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.25rem" }}>Report Symptoms</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Help India&apos;s IDSP disease surveillance. Each report earns credits and keeps your state&apos;s health map accurate.
              </div>
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <PushNotificationSetup state={profile.place} />
            </div>
            <SymptomReporter
              userState={profile.place}
              onSubmitted={() => showToast("Report submitted! Credits added to your account.")}
            />
          </div>
        )}

        {/* ── Feedback ── */}
        {tab === "feedback" && (
          <div style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>Send Feedback</div>
            {fbDone ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: "0.4rem" }}>Thank you!</div>
                <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "1.25rem" }}>Your feedback helps us improve Vyasa.</div>
                <button onClick={() => { setFbDone(false); setFbMsg(""); setFbType("general"); }} style={{ background: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "7px", padding: "0.45rem 1rem", fontSize: "0.82rem", cursor: "pointer" }}>
                  Send Another
                </button>
              </div>
            ) : (
              <form onSubmit={async e => {
                e.preventDefault();
                if (!fbMsg.trim()) return;
                setFbSaving(true);
                try {
                  await fetch("/api/feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: "feedback",
                      type: fbType,
                      message: fbMsg,
                      page: "/profile",
                      submitterName: profile.name,
                      submitterEmail: profile.email,
                    }),
                  });
                  setFbDone(true);
                } finally {
                  setFbSaving(false);
                }
              }}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={lbl}>Feedback Type</label>
                  <select style={inp} value={fbType} onChange={e => setFbType(e.target.value)}>
                    <option value="general">General Feedback</option>
                    <option value="wrong_data">Wrong / outdated data</option>
                    <option value="missing_data">Missing data or feature</option>
                    <option value="new_hospital">Add / correct a hospital</option>
                  </select>
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={lbl}>Message</label>
                  <textarea
                    style={{ ...inp, resize: "vertical" }}
                    rows={5}
                    value={fbMsg}
                    onChange={e => setFbMsg(e.target.value)}
                    placeholder="Describe your feedback, issue, or suggestion…"
                    required
                  />
                </div>
                <button type="submit" disabled={fbSaving || !fbMsg.trim()} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: "8px", padding: "0.6rem 1.5rem", fontWeight: 700, cursor: fbSaving ? "wait" : "pointer", fontSize: "0.88rem" }}>
                  {fbSaving ? "Sending…" : "Send Feedback"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Submissions ── */}
        {tab === "submissions" && (
          <div>
            {subs.length === 0 ? (
              <div style={{ backgroundColor: "#0a1628", border: "1px dashed #1e3a5f", borderRadius: "12px", padding: "3rem", textAlign: "center", color: "#475569" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📎</div>
                <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>No submissions yet</div>
                <div style={{ fontSize: "0.82rem" }}>Upload health data documents to contribute to Vyasa.</div>
                <Link href="/contribute" style={{ display: "inline-block", marginTop: "1rem", background: "#0d9488", color: "#fff", borderRadius: "8px", padding: "0.55rem 1.25rem", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
                  Submit Data →
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {subs.map(s => {
                  const statusColor = s.status === "approved" ? "#22c55e" : s.status === "rejected" ? "#ef4444" : "#eab308";
                  const parsed = (() => { try { return JSON.parse(s.extractedData ?? "{}"); } catch { return {}; } })();
                  return (
                    <div key={s._id} style={{ backgroundColor: "#0a1628", border: "1px solid #1e3a5f", borderLeft: `3px solid ${statusColor}`, borderRadius: "10px", padding: "1rem 1.1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0" }}>{s.fileName}</div>
                          <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "0.15rem" }}>
                            {s.state}{s.district ? ` · ${s.district}` : ""} · {new Date(s.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          {parsed.metrics?.length > 0 && (
                            <div style={{ fontSize: "0.68rem", color: "#334155", marginTop: "0.2rem" }}>{parsed.metrics.length} metrics extracted</div>
                          )}
                          {s.status === "rejected" && s.rejectionReason && (
                            <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: "0.35rem", backgroundColor: "#ef444410", borderRadius: "5px", padding: "0.35rem 0.6rem" }}>
                              Reason: {s.rejectionReason}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: "0.65rem", backgroundColor: statusColor + "20", color: statusColor, borderRadius: "4px", padding: "0.2rem 0.6rem", fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
