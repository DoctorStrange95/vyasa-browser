import { NextResponse } from "next/server";
import { fsGet } from "@/lib/firestore";
import { adminSet, getAdminDb } from "@/lib/firestore-admin";
import { fetchAndParseIDSPPdf } from "@/lib/idspPDFParser";
import type { IDSPParsedReport, IDSPOutbreak, IDSPNewsLink } from "@/lib/idspPDFParser";

const IDSP_LISTING = "https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689";
const CACHE_COL    = "idsp_weekly";
const CACHE_ID     = "latest_v3";  // bumped to bust stale 2016 cache
const TTL_HOURS    = 24 * 7;

export interface IDSPWeeklyMeta extends IDSPParsedReport {
  pdfUrl:    string;
  fetchedAt: string;
  fromCache?: boolean;
  stale?: boolean;
}

function cacheAge(ts: string): number {
  return (Date.now() - new Date(ts).getTime()) / 3_600_000;
}

/** Fetch top 3 Google News articles for a given query via RSS (no API key needed) */
async function fetchOutbreakNews(disease: string, state: string): Promise<IDSPNewsLink[]> {
  const query = `${disease} outbreak ${state} India`;
  const url   = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const xml   = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 0 } }).then(r => r.text());
    const items: IDSPNewsLink[] = [];
    const re    = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null && items.length < 3) {
      const block = m[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
      const link  = (block.match(/<link>(.*?)<\/link>/)?.[1] ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? "").trim();
      const pub   = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "").trim();
      // Extract source from title "Headline - Source Name"
      const lastDash = title.lastIndexOf(" - ");
      const source   = lastDash > 0 ? title.slice(lastDash + 3).trim() : "Google News";
      const cleanTitle = lastDash > 0 ? title.slice(0, lastDash).trim() : title;
      if (cleanTitle && link) items.push({ title: cleanTitle, url: link, source, publishedAt: pub });
    }
    return items;
  } catch {
    return [];
  }
}

/** Enrich outbreaks with news links — batched to avoid rate limits */
async function enrichWithNews(outbreaks: IDSPOutbreak[]): Promise<IDSPOutbreak[]> {
  // Deduplicate disease+state pairs
  const pairs = [...new Map(
    outbreaks.map(o => [`${o.disease}||${o.state}`, { disease: o.disease, state: o.state }])
  ).values()].slice(0, 25); // cap at 25 unique combos

  // Fetch in parallel (concurrency 5)
  const newsMap = new Map<string, IDSPNewsLink[]>();
  for (let i = 0; i < pairs.length; i += 5) {
    const batch = pairs.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(p => fetchOutbreakNews(p.disease, p.state))
    );
    results.forEach((r, j) => {
      const key = `${batch[j].disease}||${batch[j].state}`;
      newsMap.set(key, r.status === "fulfilled" ? r.value : []);
    });
  }

  return outbreaks.map(o => ({ ...o, newsLinks: newsMap.get(`${o.disease}||${o.state}`) ?? [] }));
}

/** Pick the PDF with the highest week for the most recent year using <a title="Nth week of YYYY"> */
async function scrapeLatestPdfUrl(): Promise<{ url: string; week: number; year: number }> {
  const html = await fetch(IDSP_LISTING, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VyasaHealth/1.0)" },
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 0 },
  }).then(r => r.text());

  // Each link has title="Nth week of YYYY" or "Nth Week of YYYY"
  const re = /<a[^>]*title="(\d{1,2})(?:st|nd|rd|th)\s+[Ww]eek\s+of\s+(\d{4})"[^>]*href="([^"]+\.pdf)"[^>]*>/gi;
  const entries: { week: number; year: number; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    entries.push({ week: parseInt(m[1]), year: parseInt(m[2]), url: m[3] });
  }

  if (entries.length === 0) throw new Error("No titled PDF links found on IDSP listing page");

  // Sort: highest year first, then highest week
  entries.sort((a, b) => b.year - a.year || b.week - a.week);
  const best = entries[0];
  const url = best.url.startsWith("http") ? best.url : `https://idsp.mohfw.gov.in${best.url}`;
  return { url, week: best.week, year: best.year };
}

async function sendOutbreakPush(report: IDSPWeeklyMeta) {
  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? "";
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@vyasaa.com";
  if (!vapidPublic || !vapidPrivate) return;

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const db = getAdminDb();
  const snap = await db.collection("push_subscriptions").limit(500).get();

  const topDiseases = Object.entries(
    (report.outbreaks ?? []).reduce<Record<string, number>>((acc, o) => {
      acc[o.disease] = (acc[o.disease] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d).join(", ");

  const payload = JSON.stringify({
    title: `IDSP Week ${report.week} · ${report.totalOutbreaks ?? report.outbreaks?.length ?? 0} Outbreaks`,
    body:  `${topDiseases} — ${report.reportingStates ?? 0} states reporting. Tap to view.`,
    url:   "/",
    tag:   "idsp-weekly",
    icon:  "/icons/icon.svg",
  });

  const stale: string[] = [];
  await Promise.allSettled(snap.docs.map(async doc => {
    const sub = doc.data();
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: sub.keys as { p256dh: string; auth: string } },
        payload,
      );
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(doc.id);
    }
  }));

  if (stale.length) {
    const batch = db.batch();
    stale.forEach(id => batch.delete(db.collection("push_subscriptions").doc(id)));
    await batch.commit();
  }
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";

  // Serve Firestore cache if fresh
  if (!force) {
    const cached = await fsGet(CACHE_COL, CACHE_ID) as IDSPWeeklyMeta | null;
    if (cached?.fetchedAt && cacheAge(cached.fetchedAt) < TTL_HOURS && cached.pdfUrl && (cached.outbreaks?.length ?? 0) > 0) {
      return NextResponse.json({ ...cached, fromCache: true });
    }
  }

  try {
    const { url: pdfUrl, week: scraped_week, year: scraped_year } = await scrapeLatestPdfUrl();

    const parsed = await fetchAndParseIDSPPdf(pdfUrl);
    if (!parsed) throw new Error("PDF parse returned null");

    // Enrich outbreaks with Google News coverage
    const enrichedOutbreaks = await enrichWithNews(parsed.outbreaks ?? []);

    const fresh: IDSPWeeklyMeta = {
      ...parsed,
      outbreaks: enrichedOutbreaks,
      week:  parsed.week  || scraped_week,
      year:  parsed.year  || scraped_year,
      pdfUrl,
      fetchedAt: new Date().toISOString(),
    };

    // Save latest (used by home page cache)
    await adminSet(CACHE_COL, CACHE_ID, fresh as unknown as Record<string, unknown>);

    // Save historical snapshot keyed by year+week — never overwrite an existing week
    const weekDocId = `${fresh.year}_w${String(fresh.week).padStart(2, "0")}`;
    const alreadySaved = await fsGet(CACHE_COL, weekDocId);
    if (!alreadySaved) {
      await adminSet(CACHE_COL, weekDocId, fresh as unknown as Record<string, unknown>);
      // New week — send push notifications to all subscribers
      sendOutbreakPush(fresh).catch(() => {});
    }

    return NextResponse.json({ ...fresh, fromCache: false });
  } catch (err) {
    const cached = await fsGet(CACHE_COL, CACHE_ID) as IDSPWeeklyMeta | null;
    if (cached?.pdfUrl) return NextResponse.json({ ...cached, fromCache: true, stale: true });
    return NextResponse.json({
      week: 0, year: new Date().getFullYear(), dateRange: "", pdfUrl: IDSP_LISTING,
      reportingStates: 18, totalOutbreaks: 0, outbreaks: [],
      fetchedAt: new Date().toISOString(), error: String(err), fromCache: false,
    });
  }
}
