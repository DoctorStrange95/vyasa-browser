/**
 * Shared IDSP listing-page scraper.
 * Parses all weekly PDF links for all years from the IDSP Weekly Outbreaks page.
 */

export const IDSP_LISTING = "https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689";

export interface IDSPPdfEntry {
  week:        number;
  year:        number;
  contextYear: number; // year inferred from nearest <strong>YYYY</strong> heading
  url:         string;
}

/** Fetch the IDSP listing page and return all weekly PDF entries found. */
export async function scrapeAllPdfEntries(): Promise<IDSPPdfEntry[]> {
  const html = await fetch(IDSP_LISTING, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VyasaHealth/1.0)" },
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 0 },
  }).then(r => r.text());

  const entries: IDSPPdfEntry[] = [];
  const linkRe = /(<a\s[^>]*href="([^"]+\.pdf)"[^>]*>)([^<]*)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const tag      = m[1];
    const rawUrl   = m[2];
    const linkText = m[3].replace(/&nbsp;/gi, "").trim();
    const url      = rawUrl.startsWith("http") ? rawUrl : `https://idsp.mohfw.gov.in${rawUrl}`;

    // Find the nearest <strong>YYYY</strong> heading before this position
    const before = html.slice(0, m.index);
    const yearMatches = [...before.matchAll(/<strong>(\d{4})<\/strong>/g)];
    const contextYear = yearMatches.length > 0 ? parseInt(yearMatches[yearMatches.length - 1][1]) : 0;

    // Method 1: title="Nth week of YYYY"
    const titleM = tag.match(/title="(\d{1,2})(?:st|nd|rd|th)\s+[Ww]eek\s+of\s+(\d{4})"/i);
    if (titleM) {
      const titleWeek = parseInt(titleM[1]);
      const titleYear = parseInt(titleM[2]);
      // Use context year when title year disagrees with context (IDSP data entry typos)
      const effectiveYear = (contextYear > 2000 && titleYear !== contextYear) ? contextYear : titleYear;
      entries.push({ week: titleWeek, year: effectiveYear, contextYear, url });
      continue;
    }

    // Method 2: no title — infer week from ordinal link text ("14th", "15th")
    const textM = linkText.match(/^(\d{1,2})(?:st|nd|rd|th)$/i);
    if (textM && contextYear > 2000) {
      entries.push({ week: parseInt(textM[1]), year: contextYear, contextYear, url });
    }
  }

  return entries;
}

/** Return only entries for a specific year, deduplicated (latest URL wins per week). */
export function entriesForYear(all: IDSPPdfEntry[], year: number): IDSPPdfEntry[] {
  const best = new Map<number, IDSPPdfEntry>();
  for (const e of all) {
    if (e.year !== year) continue;
    const prev = best.get(e.week);
    // Prefer titled entries over untitled; otherwise last seen wins
    if (!prev) best.set(e.week, e);
  }
  return [...best.values()].sort((a, b) => a.week - b.week);
}
