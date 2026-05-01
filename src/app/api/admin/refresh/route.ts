/**
 * Admin manual refresh endpoint.
 * POST { source: "aqi" | "phc" | "idsp" | "srs" | "all" }
 * Fetches fresh data from the requested source and returns results.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { writeFile, readFile } from "fs/promises";
import path from "path";

const GOV_KEY = process.env.DATA_GOV_IN_API_KEY!;
const BASE    = "https://api.data.gov.in/resource";

// Vercel's /var/task is read-only; only /tmp is writable at runtime
const IDSP_CACHE  = path.join(process.cwd(), "src/data/idsp-cache.json");
const PHI_CACHE   = path.join(process.cwd(), "src/data/ph-intelligence-cache.json");
const IDSP_TMP    = "/tmp/idsp-cache.json";
const PHI_TMP     = "/tmp/ph-intelligence-cache.json";

async function writeCacheSafe(defaultPath: string, tmpPath: string, data: string) {
  try { await writeFile(defaultPath, data); }
  catch { await writeFile(tmpPath, data); }
}

async function readCacheSafe(defaultPath: string, tmpPath: string): Promise<string> {
  try { return await readFile(tmpPath, "utf-8"); } catch { /* no tmp */ }
  return readFile(defaultPath, "utf-8");
}

export async function POST(req: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await req.json();
  const results: Record<string, unknown> = {};
  const log: string[] = [];
  const start = Date.now();

  const doAQI = source === "aqi"  || source === "all";
  const doPHC = source === "phc"  || source === "all";
  const doIDP = source === "idsp" || source === "all";
  const doSRS = source === "srs"  || source === "all";
  const doPHI = source === "ph-intelligence" || source === "all";
  const doPages = source === "all";

  // ── 1. AQI refresh ──────────────────────────────────────────────────────────
  if (doAQI) {
    try {
      const url = `${BASE}/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${GOV_KEY}&format=json&limit=10`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const count = (data.records ?? []).length;
      results.aqi = { ok: true, sampleCount: count, status: data.status };
      log.push(`✓ CPCB AQI: ${count} station records fetched`);
      revalidatePath("/district/[slug]", "page");
      log.push("✓ Queued district page revalidation");
    } catch (e) { log.push(`✗ AQI refresh failed: ${e}`); results.aqi = { ok: false }; }
  }

  // ── 2. PHC/CHC refresh ──────────────────────────────────────────────────────
  if (doPHC) {
    try {
      const url = `${BASE}/4e3c855c-c10c-479e-ae6e-187bfed35ac1?api-key=${GOV_KEY}&format=json&limit=40`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const states = (data.records ?? []).length;
      results.phc = { ok: true, statesReturned: states };
      log.push(`✓ PHC/CHC: ${states} states refreshed`);
      revalidatePath("/state/[slug]", "page");
    } catch (e) { log.push(`✗ PHC/CHC refresh failed: ${e}`); results.phc = { ok: false }; }
  }

  // ── 3. IDSP / disease data refresh ─────────────────────────────────────────
  if (doIDP) {
    try {
      const { refreshAllHealthData } = await import("@/lib/idsp");
      const data = await refreshAllHealthData();
      await writeCacheSafe(IDSP_CACHE, IDSP_TMP, JSON.stringify(data, null, 2));

      // Persist metadata to Firestore so it survives Vercel deploys
      try {
        const { getAdminDb } = await import("@/lib/firestore-admin");
        const metaDb = getAdminDb();
        await metaDb.collection("_meta").doc("idsp").set({
          lastRefresh:    new Date().toISOString(),
          diseaseRecords: data.diseaseRecords.length,
          outbreaks:      data.outbreaks.length,
          nhpAlerts:      data.nhpAlerts.length,
          hospitalBeds:   data.hospitalBeds.length,
        });
      } catch { /* non-fatal — status display only */ }

      results.idsp = {
        ok: true,
        diseaseRecords: data.diseaseRecords.length,
        outbreaks: data.outbreaks.length,
        nhpAlerts: data.nhpAlerts.length,
        hospitalBeds: data.hospitalBeds.length,
      };
      log.push(`✓ IDSP: ${data.diseaseRecords.length} disease records, ${data.outbreaks.length + data.nhpAlerts.length} alerts`);
    } catch (e) { log.push(`✗ IDSP refresh failed: ${e}`); results.idsp = { ok: false }; }
  }

  // ── 4. SRS data check ───────────────────────────────────────────────────────
  if (doSRS) {
    try {
      const url = `${BASE}/7c568619-b9b4-40bb-b563-68c28c27a6c1?api-key=${GOV_KEY}&format=json&limit=5`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const updated = data?.updated ?? data?.last_updated ?? "unknown";
      results.srs = { ok: true, lastUpdated: updated, total: data?.total };
      log.push(`✓ SRS check: last updated ${updated}`);
    } catch (e) { log.push(`✗ SRS check failed: ${e}`); results.srs = { ok: false }; }
  }

  // ── 5. Public Health Intelligence refresh ──────────────────────────────────
  if (doPHI) {
    try {
      const { collectPHIntelligence } = await import("@/lib/phIntelligence");
      const data = await collectPHIntelligence();
      const payload = { ...data, refreshedAt: new Date().toISOString() };
      await writeCacheSafe(PHI_CACHE, PHI_TMP, JSON.stringify(payload, null, 2));

      // Save new items to Firestore — skip any item already in Firestore (any status/age)
      // This prevents overwriting admin-reviewed items back to "pending"
      const { adminList, getAdminDb } = await import("@/lib/firestore-admin");
      const existing    = await adminList("ph_intelligence", 2000);
      const existingIds = new Set(existing.map(d => d._id));
      const db = getAdminDb();
      let saved = 0;
      let skipped = 0;
      const saveErrors: string[] = [];
      await Promise.allSettled(
        data.items.slice(0, 80).map(async (item) => {
          try {
            const urlPart = item.sourceUrl ? item.sourceUrl.replace(/[^a-zA-Z0-9]/g, "").slice(-40) : item.title.slice(40, 80);
            const raw = `${item.type}::${item.disease ?? item.program ?? ""}::${item.location.state}::${item.title.slice(0, 40)}::${urlPart}`;
            const id  = Buffer.from(raw).toString("base64").replace(/[/+=]/g, "_").slice(0, 100);
            if (existingIds.has(id)) {
              skipped++;
            } else {
              // JSON round-trip strips undefined fields — Firestore rejects them
              const clean = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
              await db.collection("ph_intelligence").doc(id).set({
                ...clean,
                _id: id,
                status: "pending",
                scrapedAt: new Date().toISOString(),
              });
              saved++;
            }
          } catch (e) { saveErrors.push(String(e).slice(0, 80)); }
        })
      );

      const errNote = saveErrors.length ? ` | ${saveErrors.length} errors: ${saveErrors[0]}` : "";
      results["ph-intelligence"] = { ok: true, items: data.items.length, newPending: saved, skipped, sources: data.sources.length };
      log.push(`✓ PH Intelligence: ${data.items.length} items, ${saved} new saved, ${skipped} skipped (dedup)${errNote}`);
      revalidatePath("/");
    } catch (e) { log.push(`✗ PH Intelligence refresh failed: ${e}`); results["ph-intelligence"] = { ok: false }; }
  }

  // ── 6. Revalidate all pages ──────────────────────────────────────────────────
  if (doPages) {
    revalidatePath("/");
    revalidatePath("/district/[slug]", "page");
    revalidatePath("/state/[slug]",    "page");
    log.push("✓ All pages queued for revalidation");
  }

  return NextResponse.json({
    ok: true,
    source,
    elapsed_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
    results,
    log,
  });
}

// GET: return current cache status from Firestore (persists across Vercel deploys)
export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { getAdminDb } = await import("@/lib/firestore-admin");
    const db  = getAdminDb();
    const doc = await db.collection("_meta").doc("idsp").get();
    const meta = doc.exists ? (doc.data() as Record<string, unknown>) : {};
    return NextResponse.json({
      idsp: {
        lastRefresh:    meta.lastRefresh    ?? null,
        diseaseRecords: meta.diseaseRecords ?? 0,
        outbreaks:      meta.outbreaks      ?? 0,
        nhpAlerts:      meta.nhpAlerts      ?? 0,
        hospitalBeds:   meta.hospitalBeds   ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({
      idsp: { lastRefresh: null, diseaseRecords: 0, outbreaks: 0, nhpAlerts: 0, hospitalBeds: 0 },
      metaError: String(e),
    });
  }
}
