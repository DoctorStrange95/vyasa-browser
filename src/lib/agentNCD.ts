/**
 * Agent 2 — NCD (Non-Communicable Disease) Intelligence
 *
 * Covers national programs for:
 *   • Cardiovascular diseases — heart attack (MI), stroke, IHD, hypertension
 *   • Cancer — NPCDCS, cervical/breast/oral/lung cancer screening
 *   • Diabetes — T2DM, pre-diabetes, NPCDCS screening
 *   • Chronic Respiratory — COPD, asthma
 *   • Chronic Kidney Disease (CKD)
 *   • NAFLD (Non-Alcoholic Fatty Liver Disease)
 *   • Obesity, tobacco-related, mental health (as comorbidities)
 *
 * Sources:
 *  1. PIB RSS filtered for NCD keywords
 *  2. MoHFW homepage NCD section
 *  3. data.gov.in NCD / NPCDCS datasets
 *  4. Google News RSS — India NCD / cardiovascular / cancer
 *  5. ICMR / WHO India (scraping key headlines)
 */

import { extractLocation } from "./agentLocation";
import type { PHIntelligenceItem } from "./phIntelligence";

const GOV_KEY = process.env.DATA_GOV_IN_API_KEY ?? "";
const BASE    = "https://api.data.gov.in/resource";
const CURRENT_YEAR = new Date().getFullYear();

// ── NCD disease / condition keywords ─────────────────────────────────────────
const NCD_DISEASE_DICT: Record<string, string> = {
  // Cardiovascular
  "heart attack"          : "Heart Attack (MI)",
  "myocardial infarction" : "Heart Attack (MI)",
  " mi "                  : "Heart Attack (MI)",
  " ami "                 : "Heart Attack (Acute MI)",
  stroke                  : "Stroke",
  "cerebrovascular"       : "Stroke",
  "brain stroke"          : "Stroke",
  "ischemic stroke"       : "Ischaemic Stroke",
  "haemorrhagic stroke"   : "Haemorrhagic Stroke",
  "hemorrhagic stroke"    : "Haemorrhagic Stroke",
  "coronary artery"       : "Coronary Artery Disease",
  "coronary heart"        : "Coronary Heart Disease",
  "ischemic heart"        : "Ischaemic Heart Disease",
  "ischaemic heart"       : "Ischaemic Heart Disease",
  " ihd "                 : "Ischaemic Heart Disease",
  "cardiovascular"        : "Cardiovascular Disease",
  "cardiac arrest"        : "Cardiac Arrest",
  "heart failure"         : "Heart Failure",
  "atrial fibrillation"   : "Atrial Fibrillation",
  hypertension            : "Hypertension",
  "high blood pressure"   : "Hypertension",
  "blood pressure"        : "Hypertension",
  // Cancer
  cancer                  : "Cancer",
  carcinoma               : "Cancer",
  tumour                  : "Cancer",
  tumor                   : "Cancer",
  "cervical cancer"       : "Cervical Cancer",
  "breast cancer"         : "Breast Cancer",
  "oral cancer"           : "Oral Cancer",
  "mouth cancer"          : "Oral Cancer",
  "lung cancer"           : "Lung Cancer",
  "colorectal cancer"     : "Colorectal Cancer",
  "colon cancer"          : "Colorectal Cancer",
  "liver cancer"          : "Liver Cancer",
  "gallbladder cancer"    : "Gallbladder Cancer",
  "stomach cancer"        : "Gastric Cancer",
  "prostate cancer"       : "Prostate Cancer",
  "leukaemia"             : "Leukaemia",
  "leukemia"              : "Leukaemia",
  "lymphoma"              : "Lymphoma",
  "melanoma"              : "Melanoma",
  "oncology"              : "Cancer",
  "chemotherapy"          : "Cancer",
  "radiotherapy"          : "Cancer",
  // Diabetes
  diabetes                : "Diabetes",
  "type 2 diabetes"       : "Type 2 Diabetes",
  "t2dm"                  : "Type 2 Diabetes",
  "type 1 diabetes"       : "Type 1 Diabetes",
  "t1dm"                  : "Type 1 Diabetes",
  "pre-diabetes"          : "Pre-Diabetes",
  prediabetes             : "Pre-Diabetes",
  "blood sugar"           : "Diabetes",
  "insulin resistance"    : "Diabetes",
  "hyperglycaemia"        : "Diabetes",
  "hyperglycemia"         : "Diabetes",
  // Chronic Respiratory
  " copd "                : "COPD",
  "chronic obstructive"   : "COPD",
  asthma                  : "Asthma",
  "bronchial asthma"      : "Asthma",
  "chronic bronchitis"    : "Chronic Bronchitis",
  "interstitial lung"     : "ILD",
  "pulmonary fibrosis"    : "Pulmonary Fibrosis",
  "respiratory disease"   : "Chronic Respiratory Disease",
  // Chronic Kidney Disease
  " ckd "                 : "CKD",
  "chronic kidney"        : "CKD",
  "renal failure"         : "CKD",
  "kidney disease"        : "CKD",
  "kidney failure"        : "CKD",
  dialysis                : "CKD (Dialysis)",
  "end-stage renal"       : "ESRD",
  esrd                    : "ESRD",
  "glomerulonephritis"    : "CKD",
  // NAFLD / Liver
  nafld                   : "NAFLD",
  "fatty liver"           : "NAFLD",
  "non-alcoholic fatty"   : "NAFLD",
  "non alcoholic fatty"   : "NAFLD",
  nash                    : "NASH",
  cirrhosis               : "Liver Cirrhosis",
  "liver fibrosis"        : "Liver Fibrosis",
  // Comorbidities
  obesity                 : "Obesity",
  "overweight"            : "Obesity",
  "body mass index"       : "Obesity",
  " bmi "                 : "Obesity",
  "metabolic syndrome"    : "Metabolic Syndrome",
  "dyslipidaemia"         : "Dyslipidaemia",
  "dyslipidemia"          : "Dyslipidaemia",
  cholesterol             : "Dyslipidaemia",
  "high cholesterol"      : "Dyslipidaemia",
};

// ── NCD program keywords ──────────────────────────────────────────────────────
const NCD_PROGRAM_DICT: Record<string, string> = {
  npcdcs                              : "NPCDCS",
  "national programme for non-communicable": "NPCDCS",
  "national programme for prevention and control": "NPCDCS",
  "national cancer control"           : "National Cancer Control Programme",
  "cancer screening"                  : "Cancer Screening Programme",
  "cervical screening"                : "Cervical Cancer Screening",
  "breast screening"                  : "Breast Cancer Screening",
  "national diabetes control"         : "National Diabetes Control Programme",
  "diabetes management"               : "Diabetes Management Programme",
  "cardiovascular risk"               : "NPCDCS CVD Programme",
  "hypertension control"              : "Hypertension Control Programme",
  "tobacco control"                   : "National Tobacco Control Programme",
  ntcp                                : "NTCP",
  "health and wellness"               : "Health & Wellness Centres (HWC)",
  "hwc"                               : "Health & Wellness Centres",
  "ayushman bharat"                   : "Ayushman Bharat PMJAY",
  pmjay                               : "PMJAY",
  "kidney transplant"                 : "National Organ Transplant Programme",
  "dialysis programme"                : "Pradhan Mantri Dialysis Programme",
  "pradhan mantri dialysis"           : "Pradhan Mantri Dialysis Programme",
  "mental health"                     : "NMHP",
  nmhp                                : "NMHP",
  "ncd screening"                     : "NCD Population Screening",
  "population screening"              : "NCD Population Screening",
  "icmr"                              : "ICMR Research",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function ageDays(isoDate: string): number {
  try {
    const ms = Date.now() - new Date(isoDate).getTime();
    return ms / 86_400_000;
  } catch { return 999; }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ")
           .replace(/&[a-z]+;/g, " ")
           .replace(/&#\d+;/g, " ")
           .replace(/\s+/g, " ")
           .trim();
}

function detectNCDDisease(text: string): string {
  const lower = ` ${text.toLowerCase()} `;
  for (const [kw, name] of Object.entries(NCD_DISEASE_DICT)) {
    if (lower.includes(kw)) return name;
  }
  return "";
}

function detectNCDProgram(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, name] of Object.entries(NCD_PROGRAM_DICT)) {
    if (lower.includes(kw)) return name;
  }
  return "";
}

function extractNumber(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    const segment = lower.slice(Math.max(0, idx - 70), idx + 70);
    const m = segment.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:cases?|deaths?|patients?|persons?|diagnosed|confirmed)/i)
           || segment.match(/(\d[\d,]*)\s+(?:new|total|reported|million|lakh|crore)/i);
    if (m) return m[1].replace(/,/g, "");
  }
  return "";
}

function extractSummary(text: string, maxLen = 280): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLen) return clean;
  const cut = clean.lastIndexOf(". ", maxLen);
  return cut > 80 ? clean.slice(0, cut + 1) : clean.slice(0, maxLen) + "…";
}

const NCD_HEALTH_KEYWORDS = /heart|cancer|diabetes|stroke|kidney|liver|copd|asthma|obesity|hypertension|cardiovascular|oncology|renal|nafld|cholesterol|insulin|ncd|non-communicable|npcdcs/;

function makeNCDItem(
  title: string, desc: string, link: string, pubDate: string,
  source: string, confidence: PHIntelligenceItem["confidence"]
): PHIntelligenceItem | null {
  const combined = `${title} ${desc}`;
  const disease  = detectNCDDisease(combined);
  const program  = detectNCDProgram(combined);
  if (!disease && !program) return null;

  const loc    = extractLocation(combined);
  const type: PHIntelligenceItem["type"] = disease ? "NCD" : "Program";
  const cases  = extractNumber(combined, ["cases", "patients", "diagnosed", "confirmed"]);
  const deaths = extractNumber(combined, ["deaths", "died", "fatalities", "mortality"]);
  const date   = pubDate ? (() => { try { return new Date(pubDate).toISOString().split("T")[0]; } catch { return new Date().toISOString().split("T")[0]; } })() : new Date().toISOString().split("T")[0];

  return {
    type,
    category: "ncd",
    title:    title.slice(0, 130),
    disease:  disease  || undefined,
    program:  program  || undefined,
    location: loc,
    summary:  desc ? extractSummary(desc) : extractSummary(title),
    cases, deaths, date, source,
    sourceUrl: link || undefined,
    confidence,
  };
}

// ── Source 1: PIB RSS filtered for NCD ────────────────────────────────────────
async function fetchPIBNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch(
      "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
      { headers: { "User-Agent": "Vyasa/2.0" }, redirect: "follow", next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return items;
    const xml    = await res.text();
    const itemRE = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRE.exec(xml)) !== null) {
      const b       = m[1];
      const title   = stripHtml(b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const desc    = stripHtml(b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? "");
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
      if (!title) continue;
      const item = makeNCDItem(title, desc, link, pubDate, "PIB — NCD / MoHFW", "High");
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items.slice(0, 15);
}

// ── Source 2: MoHFW NCD section ───────────────────────────────────────────────
async function fetchMoHFWNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const urls = [
    "https://www.mohfw.gov.in/",
    "https://main.mohfw.gov.in/ncd",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0" },
        next:    { revalidate: 0 },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html   = await res.text();
      const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRE.exec(html)) !== null) {
        const text = stripHtml(m[2]);
        if (text.length < 20 || text.length > 320) continue;
        const item = makeNCDItem(text, text, m[1].startsWith("http") ? m[1] : `https://www.mohfw.gov.in${m[1]}`, "", "MoHFW NCD Division", "High");
        if (item) items.push(item);
      }
    } catch { continue; }
    if (items.length >= 8) break;
  }
  return items.slice(0, 10);
}

// ── Source 3: data.gov.in NCD datasets ───────────────────────────────────────
async function fetchDataGovNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  if (!GOV_KEY) return items;
  // Known data.gov.in resource IDs for NCD-related data
  const resources = [
    { id: "97a6dc3b-d4dc-4e61-a1f9-9a6956ab6e93", label: "Cancer Registry" },
    { id: "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69", label: "Diabetes Prevalence" },
    { id: "a4a0c7c9-4c1d-4d36-9bdd-0ce60a1a5567", label: "NCD Health Data" },
  ];
  for (const { id, label } of resources) {
    try {
      const url = `${BASE}/${id}?api-key=${GOV_KEY}&format=json&limit=30`;
      const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data    = await res.json();
      const records: Record<string, string>[] = data.records ?? [];
      if (!records.length) continue;

      for (const r of records.slice(0, 15)) {
        const condition = r.condition ?? r.disease ?? r.name ?? r.cancer_type ?? "";
        const state     = r.state ?? r.state_ut ?? r.state_name ?? "";
        const cases     = parseInt(r.cases ?? r.patients ?? r.incidence ?? "0") || 0;
        const deaths    = parseInt(r.deaths ?? r.mortality ?? "0") || 0;
        const year      = r.year ?? r.report_year ?? "";
        if (!condition || !state) continue;

        const normalized = detectNCDDisease(condition) || condition;
        items.push({
          type:     "NCD",
          category: "ncd",
          title:    `${normalized} — ${state}`,
          disease:  normalized,
          location: { state, district: r.district ?? "", village: "" },
          summary:  `NCD data (${label}): ${cases > 0 ? cases.toLocaleString() + " cases" : "data recorded"}${deaths > 0 ? `, ${deaths} deaths` : ""} of ${normalized} in ${state}${year ? ` (${year})` : ""}.`,
          cases:    cases  > 0 ? String(cases)  : "",
          deaths:   deaths > 0 ? String(deaths) : "",
          date:     year ? `${year.slice(0, 4)}-01-01` : new Date().toISOString().split("T")[0],
          source:   `data.gov.in — ${label}`,
          confidence: "High",
        });
      }
      if (items.length >= 8) break;
    } catch { continue; }
  }
  return items;
}

// ── Source 4: Google News RSS — India NCD ─────────────────────────────────────
async function fetchGoogleNewsNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const queries = [
    `India+heart+attack+stroke+cardiovascular+health+${CURRENT_YEAR}`,
    `India+cancer+diabetes+NCD+non-communicable+disease+${CURRENT_YEAR}`,
    `India+COPD+kidney+disease+NAFLD+fatty+liver+health+${CURRENT_YEAR}`,
  ];
  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0" },
        next:    { revalidate: 0 },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml    = await res.text();
      const itemRE = /<item>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      while ((m = itemRE.exec(xml)) !== null) {
        const b       = m[1];
        const title   = stripHtml(b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
        const desc    = stripHtml(b.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
        const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "").trim();
        const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
        if (!title) continue;
        if (!/india/i.test(`${title} ${desc}`) && !extractLocation(`${title} ${desc}`).state) continue;
        const item = makeNCDItem(title, desc, link, pubDate, "Google News (India NCD)", "Medium");
        if (item) items.push(item);
      }
      if (items.length >= 8) break;
    } catch { continue; }
  }
  return items.slice(0, 12);
}

// ── Source 5: ICMR / WHO India NCD headlines (scraping) ─────────────────────
async function fetchICMRWHONCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const sources = [
    { url: "https://www.icmr.gov.in/", src: "ICMR (Indian Council of Medical Research)" },
    { url: "https://www.searo.who.int/india/en/",            src: "WHO India" },
  ];
  for (const { url, src } of sources) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0" },
        next:    { revalidate: 0 },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html   = await res.text();
      const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRE.exec(html)) !== null) {
        const text = stripHtml(m[2]);
        if (text.length < 20 || text.length > 320) continue;
        const item = makeNCDItem(text, text, m[1].startsWith("http") ? m[1] : `${url}${m[1]}`, "", src, "High");
        if (item) items.push(item);
        if (items.length >= 8) break;
      }
    } catch { continue; }
    if (items.length >= 8) break;
  }
  return items.slice(0, 10);
}

// ── Source 6: WHO India NCD + ICMR NCD research ──────────────────────────────
async function fetchWHOIndiaNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const endpoints = [
    { url: "https://www.who.int/india/news-releases",    src: "WHO India — NCD" },
    { url: "https://www.who.int/india/activities",       src: "WHO India Activities" },
    { url: "https://www.icmr.gov.in/",                   src: "ICMR" },
    { url: "https://www.icmr.gov.in/ncd.html",           src: "ICMR NCD Division" },
  ];
  for (const { url, src } of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0 (+https://healthforindia.in)" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRE.exec(html)) !== null && items.length < 10) {
        const text = stripHtml(m[2]);
        if (text.length < 20 || text.length > 320) continue;
        const item = makeNCDItem(text, text, m[1].startsWith("http") ? m[1] : `https://www.who.int${m[1]}`, "", src, "High");
        if (item) items.push(item);
      }
    } catch { continue; }
    if (items.length >= 8) break;
  }
  return items.slice(0, 10);
}

// ── Source 7: The Hindu Health RSS ───────────────────────────────────────────
async function fetchTheHinduNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch("https://www.thehindu.com/sci-tech/health/feeder/default.rss", {
      headers: { "User-Agent": "Vyasa/2.0 (+https://healthforindia.in)" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return items;
    const xml = await res.text();
    const itemRE = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRE.exec(xml)) !== null && items.length < 15) {
      const b       = m[1];
      const title   = stripHtml(b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const desc    = stripHtml(b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? b.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "").trim();
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
      if (!title) continue;
      const item = makeNCDItem(title, desc, link, pubDate, "The Hindu Health", "High");
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items;
}

// ── Source 8: Indian Express Health RSS ──────────────────────────────────────
async function fetchIndianExpressNCD(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch("https://indianexpress.com/section/health/feed/", {
      headers: { "User-Agent": "Vyasa/2.0 (+https://healthforindia.in)" },
      next:    { revalidate: 0 },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return items;
    const xml    = await res.text();
    const itemRE = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRE.exec(xml)) !== null && items.length < 20) {
      const b       = m[1];
      const title   = stripHtml(b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const desc    = stripHtml(b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? b.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "").trim();
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
      if (!title) continue;
      const item = makeNCDItem(title, desc, link, pubDate, "Indian Express Health", "High");
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items;
}

// ── Deduplication ──────────────────────────────────────────────────────────────
function dedup(items: PHIntelligenceItem[]): PHIntelligenceItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.disease ?? item.program ?? ""}::${item.location.state}::${item.title.slice(0, 45).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public entry point ─────────────────────────────────────────────────────────
export async function runNCDAgent(): Promise<{
  items:   PHIntelligenceItem[];
  sources: string[];
  errors:  string[];
}> {
  const errors:  string[] = [];
  const sources: string[] = [];

  const [pib, mohfw, dataGov, gnews, icmr, ieHealth, whoIndia, theHindu] = await Promise.allSettled([
    fetchPIBNCD(),
    fetchMoHFWNCD(),
    fetchDataGovNCD(),
    fetchGoogleNewsNCD(),
    fetchICMRWHONCD(),
    fetchIndianExpressNCD(),
    fetchWHOIndiaNCD(),
    fetchTheHinduNCD(),
  ]);

  const all: PHIntelligenceItem[] = [];

  const add = (r: PromiseSettledResult<PHIntelligenceItem[]>, label: string) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      if (r.value.length) sources.push(`${label} (${r.value.length})`);
    } else {
      errors.push(`${label}: ${r.reason}`);
    }
  };

  add(pib,       "PIB NCD");
  add(mohfw,     "MoHFW NCD");
  add(dataGov,   "data.gov.in NCD");
  add(gnews,     "Google News NCD");
  add(icmr,      "ICMR/WHO India");
  add(ieHealth,  "Indian Express Health");
  add(whoIndia,  "WHO India NCD");
  add(theHindu,  "The Hindu Health");

  const sorted = dedup(all)
    .filter(item => ageDays(item.date ?? "") <= 30)
    .sort((a, b) => {
      const cs = { High: 3, Medium: 2, Low: 1 };
      const c  = cs[b.confidence] - cs[a.confidence];
      if (c !== 0) return c;
      return (b.date ?? "").localeCompare(a.date ?? "");
    });

  return { items: sorted.slice(0, 50), sources, errors };
}
