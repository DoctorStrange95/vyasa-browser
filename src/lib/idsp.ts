/**
 * IDSP (Integrated Disease Surveillance Programme) + extended health data
 * Sources:
 *   1. data.gov.in — IDSP disease burden dataset
 *   2. NHP India disease surveillance page (scraped)
 *   3. data.gov.in — multiple health datasets
 */

const GOV_KEY = process.env.DATA_GOV_IN_API_KEY!;
const BASE    = "https://api.data.gov.in/resource";

// data.gov.in resource IDs
const RES_IDSP_WEEKLY  = "9ef84268-d588-465a-a308-a864a43d0070"; // IDSP weekly disease data
const RES_IDSP_ANNUAL  = "2b4e3be5-18c0-4a95-98f6-57c4285ea9aa"; // IDSP annual disease burden
const RES_HOSP_BEDS    = "c5f17a0c-31be-4499-a5fb-db853c4c0c4e"; // hospital beds per state
const RES_MATERNAL     = "cef6b24c-6789-4916-b3bf-96bbba63b2b5"; // maternal health indicators

export interface IDSPRecord {
  state:        string;
  disease:      string;
  cases:        number;
  deaths:       number;
  year:         string;
  week?:        string;
  source:       "data.gov.in";
}

export interface OutbreakAlert {
  id:          string;
  disease:     string;
  state:       string;
  district?:   string;
  cases:       number;
  deaths:      number;
  status:      "active" | "contained" | "monitoring";
  reportDate:  string;
  source:      string;
  url?:        string;
}

export interface HospitalBedsRecord {
  state:         string;
  totalBeds:     number;
  govt:          number;
  private:       number;
  per1000:       number;
  year:          string;
}

// ── Fetch IDSP disease data from data.gov.in ─────────────────────────────────
export async function fetchIDSPDiseaseData(): Promise<IDSPRecord[]> {
  const results: IDSPRecord[] = [];

  // Try weekly resource first, then annual
  for (const resId of [RES_IDSP_WEEKLY, RES_IDSP_ANNUAL]) {
    try {
      const url = `${BASE}/${resId}?api-key=${GOV_KEY}&format=json&limit=500`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;
      const json = await res.json();
      const records: Record<string, string>[] = json.records ?? [];
      if (!records.length) continue;

      for (const r of records) {
        const state   = r.state_ut ?? r.state ?? r.state_name ?? "";
        const disease = r.disease ?? r.disease_name ?? r.name ?? "";
        const cases   = parseInt(r.cases ?? r.total_cases ?? "0") || 0;
        const deaths  = parseInt(r.deaths ?? r.total_deaths ?? "0") || 0;
        const year    = r.year ?? r.report_year ?? "";
        if (state && disease) {
          results.push({ state, disease, cases, deaths, year, source: "data.gov.in" });
        }
      }
      if (results.length) break; // stop at first successful resource
    } catch { continue; }
  }

  return results;
}

// ── Scrape NHP disease surveillance page for outbreak alerts ──────────────────
export async function fetchNHPOutbreakAlerts(): Promise<OutbreakAlert[]> {
  const alerts: OutbreakAlert[] = [];
  try {
    // NHP disease alert RSS / JSON endpoint
    const res = await fetch(
      "https://nhp.gov.in/disease-surveillance_pg.htm",
      { headers: { "User-Agent": "Vyasa/1.0 (+https://healthforindia.in)" }, next: { revalidate: 0 } }
    );
    if (!res.ok) return alerts;
    const html = await res.text();

    // Parse disease entries from the HTML table / list structure
    // NHP page uses <table class="table"> or <ul> with disease rows
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "").trim();

    let match;
    let rowIdx = 0;
    while ((match = rowPattern.exec(html)) !== null) {
      rowIdx++;
      if (rowIdx < 3) continue; // skip header rows
      const cells: string[] = [];
      let cellMatch;
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((cellMatch = cellRegex.exec(match[1])) !== null) {
        cells.push(stripTags(cellMatch[1]));
      }
      if (cells.length >= 3) {
        const disease   = cells[0] || cells[1] || "";
        const state     = cells[1] || cells[2] || "";
        const casesStr  = cells.find(c => /^\d+$/.test(c.trim())) ?? "0";
        if (disease.length > 2 && state.length > 2) {
          alerts.push({
            id:         `nhp-${rowIdx}`,
            disease:    disease.substring(0, 80),
            state:      state.substring(0, 60),
            cases:      parseInt(casesStr) || 0,
            deaths:     0,
            status:     "monitoring",
            reportDate: new Date().toISOString().split("T")[0],
            source:     "NHP India",
            url:        "https://nhp.gov.in/disease-surveillance_pg.htm",
          });
        }
      }
    }
  } catch { /* silent — return empty on scrape failure */ }
  return alerts;
}

// ── Fetch IDSP outbreak data from data.gov.in (dedicated outbreaks resource) ──
export async function fetchIDSPOutbreaks(): Promise<OutbreakAlert[]> {
  try {
    // Try several known resource IDs for outbreak data
    const resources = [
      "57a1428c-2e5d-4c3c-a0ad-5c84b2ca5b6d", // IDSP outbreak reports
      "6ae5e4e3-c2d2-4dd6-9965-e0b4f1ed6c3d", // disease surveillance alerts
    ];
    for (const resId of resources) {
      try {
        const url = `${BASE}/${resId}?api-key=${GOV_KEY}&format=json&limit=100`;
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) continue;
        const json = await res.json();
        const records: Record<string, string>[] = json.records ?? [];
        if (!records.length) continue;

        return records.slice(0, 50).map((r, i) => ({
          id:         `idsp-${i}`,
          disease:    r.disease ?? r.disease_name ?? r.name ?? "Unknown",
          state:      r.state ?? r.state_ut ?? r.state_name ?? "India",
          district:   r.district ?? r.district_name,
          cases:      parseInt(r.cases ?? r.human_cases ?? "0") || 0,
          deaths:     parseInt(r.deaths ?? r.human_deaths ?? "0") || 0,
          status:     "monitoring" as const,
          reportDate: r.report_date ?? r.date ?? new Date().toISOString().split("T")[0],
          source:     "IDSP / data.gov.in",
          url:        "https://idsp.gov.in",
        }));
      } catch { continue; }
    }
  } catch { /* silent */ }
  return [];
}

// ── Fetch hospital beds data ─────────────────────────────────────────────────
export async function fetchHospitalBeds(): Promise<HospitalBedsRecord[]> {
  try {
    const url = `${BASE}/${RES_HOSP_BEDS}?api-key=${GOV_KEY}&format=json&limit=50`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const json = await res.json();
    const records: Record<string, string>[] = json.records ?? [];
    return records.map(r => ({
      state:     r.state ?? r.state_ut ?? "",
      totalBeds: parseInt(r.total_beds ?? r.beds_total ?? "0") || 0,
      govt:      parseInt(r.government_beds ?? r.govt_beds ?? "0") || 0,
      private:   parseInt(r.private_beds ?? "0") || 0,
      per1000:   parseFloat(r.beds_per_1000 ?? r.per_1000 ?? "0") || 0,
      year:      r.year ?? "2020",
    })).filter(r => r.state && r.totalBeds > 0);
  } catch { return []; }
}

// ── Master refresh: run all IDSP+health fetches and return combined results ───
export async function refreshAllHealthData() {
  const [diseaseData, outbreaks, nhpAlerts, hospitalBeds] = await Promise.allSettled([
    fetchIDSPDiseaseData(),
    fetchIDSPOutbreaks(),
    fetchNHPOutbreakAlerts(),
    fetchHospitalBeds(),
  ]);

  return {
    diseaseRecords: diseaseData.status === "fulfilled" ? diseaseData.value : [],
    outbreaks:      outbreaks.status  === "fulfilled" ? outbreaks.value  : [],
    nhpAlerts:      nhpAlerts.status  === "fulfilled" ? nhpAlerts.value  : [],
    hospitalBeds:   hospitalBeds.status === "fulfilled" ? hospitalBeds.value : [],
    refreshedAt:    new Date().toISOString(),
  };
}
