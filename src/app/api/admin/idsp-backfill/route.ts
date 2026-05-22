import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { adminSet, adminList } from "@/lib/firestore-admin";
import { fetchAndParseIDSPPdf } from "@/lib/idspPDFParser";
import { scrapeAllPdfEntries, entriesForYear } from "@/lib/idspScraper";

export async function POST(req: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { year?: number; force?: boolean };
  const year  = body.year  ?? new Date().getFullYear();
  const force = body.force ?? false;

  const log: string[] = [];

  try {
    // 1. Scrape all PDF entries from IDSP listing page
    log.push(`Scraping IDSP listing page for year ${year}…`);
    const allEntries = await scrapeAllPdfEntries();
    const entries = entriesForYear(allEntries, year);

    if (entries.length === 0) {
      return NextResponse.json({ ok: false, log: [...log, `✗ No PDF entries found for ${year}`] });
    }
    log.push(`✓ Found ${entries.length} weeks for ${year}: ${entries.map(e => `W${e.week}`).join(", ")}`);

    // 2. Find which weeks are already in Firestore
    const existing = await adminList("idsp_weekly", 200);
    const existingIds = new Set(
      (existing as { _id: string }[])
        .filter(d => /^\d{4}_w\d{2}$/.test(String(d._id)))
        .map(d => String(d._id))
    );

    const toFetch = entries.filter(e => {
      const docId = `${e.year}_w${String(e.week).padStart(2, "0")}`;
      return force || !existingIds.has(docId);
    });

    if (toFetch.length === 0) {
      log.push(`✓ All ${entries.length} weeks already exist in Firestore. Use force=true to re-fetch.`);
      return NextResponse.json({ ok: true, log, fetched: 0, skipped: entries.length });
    }

    const already = entries.length - toFetch.length;
    if (already > 0) log.push(`⚠ Skipping ${already} weeks already in Firestore`);
    log.push(`Fetching ${toFetch.length} missing weeks sequentially (respecting Groq rate limits)…`);

    // 3. Fetch and parse each missing week sequentially
    let fetched = 0;
    let errors  = 0;

    for (const entry of toFetch) {
      const docId = `${entry.year}_w${String(entry.week).padStart(2, "0")}`;
      try {
        log.push(`  Parsing W${entry.week} (${entry.url.split("/").pop()})…`);
        const parsed = await fetchAndParseIDSPPdf(entry.url);

        if (!parsed) {
          log.push(`  ✗ W${entry.week} — parse returned null`);
          errors++;
          continue;
        }

        const effectiveWeek = parsed.week || entry.week;
        const effectiveYear = parsed.year || entry.year;

        const doc = {
          ...parsed,
          week:      effectiveWeek,
          year:      effectiveYear,
          dateRange: parsed.week ? parsed.dateRange : `Week ${effectiveWeek}, ${effectiveYear}`,
          pdfUrl:    entry.url,
          fetchedAt: new Date().toISOString(),
        };

        await adminSet("idsp_weekly", docId, doc as unknown as Record<string, unknown>);
        log.push(`  ✓ W${effectiveWeek} saved — ${parsed.outbreaks.length} outbreaks, ${parsed.totalOutbreaks} total`);
        fetched++;

        // Small delay to avoid hammering Groq API
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        log.push(`  ✗ W${entry.week} error: ${String(e).slice(0, 120)}`);
        errors++;
      }
    }

    log.push(`Done: ${fetched} fetched, ${already} skipped, ${errors} errors`);
    return NextResponse.json({ ok: errors === 0, log, fetched, skipped: already, errors });
  } catch (err) {
    log.push(`✗ Fatal: ${String(err)}`);
    return NextResponse.json({ ok: false, log, error: String(err) }, { status: 500 });
  }
}
