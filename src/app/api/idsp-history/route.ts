import { NextResponse } from "next/server";
import { adminList } from "@/lib/firestore-admin";
import type { IDSPOutbreak } from "@/lib/idspPDFParser";

export interface IDSPWeekSnapshot {
  week: number;
  year: number;
  dateRange: string;
  totalOutbreaks: number;
  totalCases: number;
  totalDeaths: number;
  reportingStates: number;
  pdfUrl: string;
  fetchedAt: string;
}

export interface IDSPDiseaseStat {
  disease: string;
  outbreaks: number;
  cases: number;
  deaths: number;
}

export interface IDSPStateStat {
  state: string;
  outbreaks: number;
  cases: number;
  deaths: number;
  diseases: string[];
}

export interface IDSPHistoryResponse {
  year: number;
  weeks: IDSPWeekSnapshot[];
  ytdOutbreaks: number;
  ytdCases: number;
  ytdDeaths: number;
  ytdStates: number;
  diseaseBreakdown: IDSPDiseaseStat[];
  stateBreakdown: IDSPStateStat[];
  availableYears: number[];
}

type WeekDoc = {
  _id: string;
  week?: number;
  year?: number;
  dateRange?: string;
  totalOutbreaks?: number;
  reportingStates?: number;
  pdfUrl?: string;
  fetchedAt?: string;
  outbreaks?: IDSPOutbreak[];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedYear = parseInt(searchParams.get("year") ?? "0") || new Date().getFullYear();

  try {
    const all = await adminList("idsp_weekly", 200);

    // Only week snapshots (YYYY_wWW), not the latest_* docs
    const weekDocs = (all as WeekDoc[]).filter(d => /^\d{4}_w\d{2}$/.test(String(d._id)));

    const availableYears = [...new Set(weekDocs.map(d => d.year ?? parseInt(String(d._id).slice(0, 4))))].sort((a, b) => b - a);

    const yearDocs = weekDocs.filter(d => (d.year ?? parseInt(String(d._id).slice(0, 4))) === requestedYear);
    yearDocs.sort((a, b) => (a.week ?? 0) - (b.week ?? 0));

    // Deduplicate outbreaks across weeks: for each UID, keep the latest case/death count
    // (IDSP reports include cumulative totals for ongoing outbreaks across multiple weeks)
    const latestByUid = new Map<string, IDSPOutbreak & { weekSeen: number }>();
    for (const doc of yearDocs) {
      const w = doc.week ?? 0;
      for (const o of doc.outbreaks ?? []) {
        const existing = latestByUid.get(o.uid);
        if (!existing || w > existing.weekSeen) {
          latestByUid.set(o.uid, { ...o, weekSeen: w });
        }
      }
    }

    const allOutbreaks = [...latestByUid.values()];

    // YTD totals (deduplicated)
    const ytdOutbreaks = allOutbreaks.length;
    const ytdCases    = allOutbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
    const ytdDeaths   = allOutbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0);
    const ytdStates   = new Set(allOutbreaks.map(o => o.state)).size;

    // Disease breakdown (deduplicated outbreaks)
    const diseaseMap = new Map<string, IDSPDiseaseStat>();
    for (const o of allOutbreaks) {
      const d = diseaseMap.get(o.disease) ?? { disease: o.disease, outbreaks: 0, cases: 0, deaths: 0 };
      d.outbreaks++;
      d.cases  += o.cases ?? 0;
      d.deaths += o.deaths ?? 0;
      diseaseMap.set(o.disease, d);
    }
    const diseaseBreakdown = [...diseaseMap.values()].sort((a, b) => b.outbreaks - a.outbreaks);

    // State breakdown (deduplicated outbreaks)
    const stateMap = new Map<string, IDSPStateStat>();
    for (const o of allOutbreaks) {
      const s = stateMap.get(o.state) ?? { state: o.state, outbreaks: 0, cases: 0, deaths: 0, diseases: [] };
      s.outbreaks++;
      s.cases  += o.cases ?? 0;
      s.deaths += o.deaths ?? 0;
      if (!s.diseases.includes(o.disease)) s.diseases.push(o.disease);
      stateMap.set(o.state, s);
    }
    const stateBreakdown = [...stateMap.values()].sort((a, b) => b.outbreaks - a.outbreaks);

    // Per-week snapshots for the trend table
    const weeks: IDSPWeekSnapshot[] = yearDocs.map(doc => ({
      week:            doc.week ?? parseInt(String(doc._id).slice(6)),
      year:            doc.year ?? requestedYear,
      dateRange:       doc.dateRange ?? "",
      totalOutbreaks:  doc.totalOutbreaks ?? (doc.outbreaks?.length ?? 0),
      totalCases:      doc.outbreaks?.reduce((s, o) => s + (o.cases ?? 0), 0) ?? 0,
      totalDeaths:     doc.outbreaks?.reduce((s, o) => s + (o.deaths ?? 0), 0) ?? 0,
      reportingStates: doc.reportingStates ?? 0,
      pdfUrl:          doc.pdfUrl ?? "",
      fetchedAt:       doc.fetchedAt ?? "",
    }));

    const response: IDSPHistoryResponse = {
      year: requestedYear,
      weeks,
      ytdOutbreaks,
      ytdCases,
      ytdDeaths,
      ytdStates,
      diseaseBreakdown,
      stateBreakdown,
      availableYears,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
