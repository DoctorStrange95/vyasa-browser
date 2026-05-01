import { NextResponse } from "next/server";
import { adminQuery } from "@/lib/firestore-admin";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Public PH Intelligence feed.
 * Serves only admin-approved (status=live) items scraped within the last 7 days.
 * Scraping happens exclusively via the daily cron — this route never triggers a scrape.
 */
export async function GET() {
  try {
    const liveItems = await adminQuery("ph_intelligence", "status", "live", 500);

    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const recent = liveItems
      .filter(item => String(item.scrapedAt ?? item.date ?? "") >= cutoff)
      .sort((a, b) => String(b.scrapedAt ?? "").localeCompare(String(a.scrapedAt ?? "")));

    return NextResponse.json({
      items:       recent,
      sources:     [],
      errors:      [],
      refreshedAt: new Date().toISOString(),
      fromCache:   true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("PH Intelligence feed error:", msg);
    return NextResponse.json(
      { items: [], sources: [], errors: [msg], refreshedAt: null },
      { status: 500 },
    );
  }
}
