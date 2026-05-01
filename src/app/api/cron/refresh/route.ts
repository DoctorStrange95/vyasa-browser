/**
 * 48-hour refresh cron — runs every 2 days via Vercel Cron.
 * Refreshes ALL data sources:
 *   1. CPCB AQI (all 213 cities) via data.gov.in
 *   2. NHP PHC/CHC counts via data.gov.in
 *   3. Google Air Quality + Geocoding
 *   4. IDSP disease surveillance + outbreak alerts
 *   5. Hospital beds data
 *   6. SRS bulletin check
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import path from "path";

const CRON_SECRET = process.env.CRON_SECRET;
const GOV_KEY     = process.env.DATA_GOV_IN_API_KEY!;
const GOOGLE_KEY  = process.env.GOOGLE_PLACES_API_KEY;
const BASE        = "https://api.data.gov.in/resource";

const IDSP_CACHE  = path.join(process.cwd(), "src/data/idsp-cache.json");
const IDSP_TMP    = "/tmp/idsp-cache.json";
const PHI_TMP     = "/tmp/ph-intelligence-cache.json";
const PHI_DEFAULT = path.join(process.cwd(), "src/data/ph-intelligence-cache.json");

async function writeCacheSafe(defaultPath: string, tmpPath: string, data: string) {
  try { await writeFile(defaultPath, data); }
  catch { await writeFile(tmpPath, data); }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const errors: string[] = [];
  const start = Date.now();

  // ── 1. CPCB AQI sample check ─────────────────────────────────────────────
  try {
    const url = `${BASE}/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${GOV_KEY}&format=json&limit=20`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const n = (data.records ?? []).length;
    log.push(`✓ CPCB AQI: ${n} sample records (full revalidation via ISR)`);
    revalidatePath("/district/[slug]", "page");
  } catch (e) { errors.push(`✗ CPCB AQI: ${e}`); }

  // ── 2. PHC/CHC counts ────────────────────────────────────────────────────
  try {
    const url = `${BASE}/4e3c855c-c10c-479e-ae6e-187bfed35ac1?api-key=${GOV_KEY}&format=json&limit=40`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const n = (data.records ?? []).length;
    log.push(`✓ PHC/CHC: ${n} states refreshed`);
    revalidatePath("/state/[slug]", "page");
  } catch (e) { errors.push(`✗ PHC/CHC: ${e}`); }

  // ── 3. Google Air Quality spot-check (Delhi as canary) ──────────────────
  if (GOOGLE_KEY) {
    try {
      const res = await fetch(
        `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: { latitude: 28.6139, longitude: 77.2090 } }),
          cache: "no-store",
        }
      );
      const data = await res.json();
      const idx = (data.indexes ?? [])[0];
      log.push(`✓ Google AQI (Delhi canary): AQI=${idx?.aqi ?? "n/a"}, category=${idx?.category ?? "n/a"}`);
    } catch (e) { errors.push(`✗ Google AQI: ${e}`); }
  } else {
    log.push("⚠ Google AQI: key not set — skipped");
  }

  // ── 4. IDSP disease surveillance + outbreak alerts ────────────────────────
  try {
    const { refreshAllHealthData } = await import("@/lib/idsp");
    const data = await refreshAllHealthData();
    const payload = { ...data, refreshLog: log };
    await writeCacheSafe(IDSP_CACHE, IDSP_TMP, JSON.stringify(payload, null, 2));

    // Persist metadata to Firestore so admin panel status display survives deploys
    try {
      const { getAdminDb } = await import("@/lib/firestore-admin");
      await getAdminDb().collection("_meta").doc("idsp").set({
        lastRefresh:    new Date().toISOString(),
        diseaseRecords: data.diseaseRecords.length,
        outbreaks:      data.outbreaks.length,
        nhpAlerts:      data.nhpAlerts.length,
        hospitalBeds:   data.hospitalBeds.length,
      });
    } catch { /* non-fatal */ }

    log.push(`✓ IDSP: ${data.diseaseRecords.length} disease records, ${data.outbreaks.length + data.nhpAlerts.length} alerts, ${data.hospitalBeds.length} bed records`);
  } catch (e) { errors.push(`✗ IDSP refresh: ${e}`); }

  // ── 5. SRS / vital stats check via data.gov.in ───────────────────────────
  try {
    const res  = await fetch(`${BASE}/7c568619-b9b4-40bb-b563-68c28c27a6c1?api-key=${GOV_KEY}&format=json&limit=3`, { cache: "no-store" });
    const data = await res.json();
    const updated = data?.updated ?? data?.last_updated ?? "unknown";
    log.push(`✓ SRS data.gov.in: last updated ${updated}, total=${data?.total ?? "?"}`);
  } catch (e) { errors.push(`✗ SRS check: ${e}`); }

  // ── 6. PH Intelligence Feed (IDSP + NCD agents) ─────────────────────────
  try {
    const { collectPHIntelligence } = await import("@/lib/phIntelligence");
    const result  = await collectPHIntelligence();
    const payload = {
      refreshedAt: new Date().toISOString(),
      items:       result.items,
      sources:     result.sources,
      errors:      result.errors,
    };
    await writeCacheSafe(PHI_DEFAULT, PHI_TMP, JSON.stringify(payload, null, 2));

    // Save genuinely new items to ph_intelligence for admin review.
    // ID includes sourceUrl so each unique article URL gets its own slot,
    // preventing false-dedup collisions across articles with similar titles.
    const { adminList, getAdminDb } = await import("@/lib/firestore-admin");
    const existing    = await adminList("ph_intelligence", 2000);
    const existingIds = new Set(existing.map(d => String(d._id)));
    const db          = getAdminDb();
    const scrapedAt   = new Date().toISOString();
    let saved = 0;
    await Promise.allSettled(
      result.items.slice(0, 80).map(async (item) => {
        try {
          const urlPart = item.sourceUrl
            ? item.sourceUrl.replace(/[^a-zA-Z0-9]/g, "").slice(-40)
            : item.title.slice(40, 80);
          const raw = `${item.type}::${item.disease ?? item.program ?? ""}::${item.location.state}::${item.title.slice(0, 40)}::${urlPart}`;
          const id  = Buffer.from(raw).toString("base64").replace(/[/+=]/g, "_").slice(0, 100);
          if (!existingIds.has(id)) {
            await db.collection("ph_intelligence").doc(id).set({
              ...(item as unknown as Record<string, unknown>),
              _id:       id,
              status:    "pending",
              scrapedAt,
            });
            saved++;
          }
        } catch { /* silent */ }
      })
    );

    log.push(`✓ PH Intelligence: ${result.items.length} items collected, ${saved} new saved to Firestore`);
    if (result.errors.length) log.push(`  ⚠ PH errors: ${result.errors.slice(0, 3).join("; ")}`);
  } catch (e) { errors.push(`✗ PH Intelligence: ${e}`); }

  // ── 7. Revalidate all pages ───────────────────────────────────────────────
  revalidatePath("/");
  revalidatePath("/sources");
  log.push("✓ Home + sources pages revalidated");

  const elapsed = Date.now() - start;
  return NextResponse.json({
    ok: errors.length === 0,
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    log,
    errors,
    sources: {
      "CPCB AQI":     "data.gov.in · 3b01bcb8",
      "PHC/CHC":      "data.gov.in · 4e3c855c (NHP)",
      "Google AQI":   GOOGLE_KEY ? "airquality.googleapis.com" : "not configured",
      "Google Places":"maps.googleapis.com/maps/api/place",
      "Google Geocode":"maps.googleapis.com/maps/api/geocode",
      "IDSP":         "data.gov.in · IDSP + NHP scrape",
      "SRS":          "data.gov.in · 7c568619",
    },
  });
}
