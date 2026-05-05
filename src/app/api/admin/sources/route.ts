import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { adminList, adminQuery } from "@/lib/firestore-admin";
import { fsGet } from "@/lib/firestore";

const IDSP_TTL_HOURS = 24 * 7;

async function getIDSPData(req: Request) {
  const cached = await fsGet("idsp_weekly", "latest_v3");
  const fetchedAt = cached?.fetchedAt as string | undefined;
  const ageHours = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime()) / 3_600_000 : Infinity;

  // If stale, trigger a fresh fetch — this now writes via Admin SDK so it persists
  if (ageHours >= IDSP_TTL_HOURS) {
    try {
      const base = new URL(req.url).origin;
      const fresh = await fetch(`${base}/api/idsp-weekly?force=1`, { cache: "no-store" });
      if (fresh.ok) return fresh.json();
    } catch { /* fall through to cached */ }
  }
  return cached;
}

export async function GET(req: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [phi, submissions, waitlist, idspRaw, feedback, users] = await Promise.allSettled([
    Promise.all([
      adminQuery("ph_intelligence", "status", "live",     500),
      adminQuery("ph_intelligence", "status", "pending",  200),
      adminQuery("ph_intelligence", "status", "rejected", 200),
    ]).then(([live, pending, rejected]) => [...live, ...pending, ...rejected]),
    adminList("pendingSubmissions", 300),
    adminList("waitlist", 500),
    getIDSPData(req),
    adminList("feedback", 500),
    adminList("users", 500),
  ]);

  // Surface service-account errors so the admin UI can show an actionable banner
  const firstErr = [phi, submissions, waitlist, feedback, users]
    .find(r => r.status === "rejected")
    ?.reason as Error | undefined;
  const adminError = firstErr?.message?.includes("FIREBASE_SERVICE_ACCOUNT_KEY")
    ? "FIREBASE_SERVICE_ACCOUNT_KEY is not configured in Vercel environment variables. Go to Vercel → your project → Settings → Environment Variables, add FIREBASE_SERVICE_ACCOUNT_KEY (paste the full service account JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key), then redeploy."
    : firstErr
    ? `Admin SDK error: ${firstErr.message}`
    : null;

  return NextResponse.json({
    _error:      adminError,
    phi:         phi.status         === "fulfilled" ? phi.value         : [],
    submissions: submissions.status === "fulfilled" ? submissions.value : [],
    waitlist:    waitlist.status    === "fulfilled" ? waitlist.value    : [],
    idsp:        idspRaw.status     === "fulfilled" ? (idspRaw.value as Record<string, unknown> | null) : null,
    feedback:    feedback.status    === "fulfilled" ? feedback.value    : [],
    users:       users.status       === "fulfilled" ? users.value       : [],
  });
}
