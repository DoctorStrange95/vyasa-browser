/**
 * Agent 1 — IDSP / Communicable Disease Intelligence
 *
 * Covers all 34 IDSP notifiable diseases + IHIP diseases (HIV/AIDS, Hepatitis B/C,
 * TB, Kala-Azar, Filariasis) plus novel pathogen tracking.
 *
 * Sources (all RSS/HTML — no API key required for most):
 *  1. PIB (Press Information Bureau) Health Ministry RSS
 *  2. MoHFW homepage headlines
 *  3. data.gov.in IDSP disease surveillance API  (historical reference)
 *  4. NHP / NCDC disease surveillance page scraping
 *  5. Google News RSS — India disease outbreaks (no API key needed)
 *  6. Outbreak News Today RSS (global surveillance feed)
 *  7. The Hindu Health RSS
 *  8. NDTV India Health RSS
 *  9. Times of India Health RSS
 * 10. The Wire Science & Health RSS
 * 11. Hindustan Times Health RSS
 * 12. WHO SEARO / WHO News (India-filtered)
 * 13. ANI News Health RSS
 */

import { extractLocation } from "./agentLocation";
import type { PHIntelligenceItem } from "./phIntelligence";

const GOV_KEY = process.env.DATA_GOV_IN_API_KEY ?? "";
const BASE    = "https://api.data.gov.in/resource";

const CURRENT_YEAR = new Date().getFullYear();

// ── All 34 IDSP notifiable diseases + IHIP diseases ────────────────────────────
const IDSP_DISEASE_DICT: Record<string, string> = {
  // Water-borne / food-borne
  cholera             : "Cholera",
  "acute diarrhoeal"  : "Acute Diarrhoeal Disease",
  "acute diarrheal"   : "Acute Diarrhoeal Disease",
  "add "              : "Acute Diarrhoeal Disease",
  dysentery           : "Dysentery",
  typhoid             : "Typhoid",
  "enteric fever"     : "Typhoid",
  "food poisoning"    : "Food Poisoning",
  // Hepatitis
  "viral hepatitis"   : "Viral Hepatitis",
  "hepatitis a"       : "Hepatitis A",
  "hepatitis b"       : "Hepatitis B",
  "hepatitis c"       : "Hepatitis C",
  "hepatitis e"       : "Hepatitis E",
  hepatitis           : "Hepatitis",
  // Vector-borne
  malaria             : "Malaria",
  "p. falciparum"     : "Malaria (P.f.)",
  "p. vivax"          : "Malaria (P.v.)",
  "p.f."              : "Malaria (P.f.)",
  dengue              : "Dengue",
  "dhf"               : "Dengue Haemorrhagic Fever",
  "dss"               : "Dengue Shock Syndrome",
  chikungunya         : "Chikungunya",
  "japanese encephalitis" : "Japanese Encephalitis",
  "j.e."              : "Japanese Encephalitis",
  "aes"               : "Acute Encephalitis Syndrome",
  "acute encephalitis": "Acute Encephalitis Syndrome",
  meningitis          : "Meningitis",
  "kala-azar"         : "Kala-Azar",
  "kala azar"         : "Kala-Azar",
  leishmaniasis       : "Kala-Azar",
  filariasis          : "Lymphatic Filariasis",
  "lymphatic filariasis": "Lymphatic Filariasis",
  "kyasanur"          : "Kyasanur Forest Disease",
  "kfd"               : "Kyasanur Forest Disease",
  // Respiratory
  "acute respiratory infection": "ARI",
  " ari "             : "ARI",
  pneumonia           : "Pneumonia",
  influenza           : "Influenza",
  "h1n1"              : "H1N1 Influenza",
  "swine flu"         : "H1N1 Influenza",
  "h3n2"              : "H3N2 Influenza",
  "h5n1"              : "H5N1 Avian Influenza",
  "avian influenza"   : "Avian Influenza",
  "bird flu"          : "Avian Influenza",
  "viral fever"       : "Viral Fever",
  // Vaccine-preventable
  measles             : "Measles",
  mumps               : "Mumps",
  rubella             : "Rubella",
  pertussis           : "Pertussis",
  "whooping cough"    : "Pertussis",
  diphtheria          : "Diphtheria",
  tetanus             : "Tetanus",
  rabies              : "Rabies",
  polio               : "Polio",
  // Zoonotic / NTD
  leptospirosis       : "Leptospirosis",
  "scrub typhus"      : "Scrub Typhus",
  plague              : "Plague",
  anthrax             : "Anthrax",
  brucellosis         : "Brucellosis",
  "rat fever"         : "Leptospirosis",
  // Emerging / novel
  covid               : "COVID-19",
  "sars-cov"          : "COVID-19",
  "sars"              : "SARS",
  nipah               : "Nipah",
  zika                : "Zika",
  monkeypox           : "Mpox",
  mpox                : "Mpox",
  "cchf"              : "CCHF",
  "crimean"           : "CCHF",
  hanta               : "Hantavirus",
  mucormycosis        : "Mucormycosis",
  "black fungus"      : "Mucormycosis",
  // IHIP / blood-borne
  "hiv/aids"          : "HIV/AIDS",
  hiv                 : "HIV",
  aids                : "HIV/AIDS",
  tuberculosis        : "TB",
  " tb "              : "TB",
  "multi-drug resistant": "MDR-TB",
  "mdr-tb"            : "MDR-TB",
  "xdr-tb"            : "XDR-TB",
};

// Program keywords specific to communicable disease control
const IDSP_PROGRAM_DICT: Record<string, string> = {
  "tb elimination"    : "TB Elimination Mission",
  nikshay             : "Nikshay TB Program",
  "pulse polio"       : "Pulse Polio",
  "polio immunization": "Polio Immunization",
  immunization        : "Universal Immunization Programme",
  "mission indradhanush": "Mission Indradhanush",
  "national vector borne": "NVBDCP",
  nvbdcp              : "NVBDCP",
  "malaria elimination": "National Malaria Elimination Programme",
  "kala-azar elimination": "Kala-Azar Elimination Programme",
  "filariasis elimination": "Filariasis Elimination Programme",
  "hiv/aids program"  : "NACO HIV Programme",
  naco                : "NACO HIV Programme",
  "hepatitis elimination": "National Viral Hepatitis Control Programme",
  nvhcp               : "NVHCP",
  idsp                : "IDSP Surveillance",
  "idsp surveillance" : "IDSP Surveillance",
  ncdc                : "NCDC Surveillance",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ")
           .replace(/&[a-z]+;/g, " ")
           .replace(/&#\d+;/g, " ")
           .replace(/\s+/g, " ")
           .trim();
}

function detectIDSPDisease(text: string): string {
  const lower = ` ${text.toLowerCase()} `;
  for (const [kw, name] of Object.entries(IDSP_DISEASE_DICT)) {
    if (lower.includes(kw)) return name;
  }
  return "";
}

function detectIDSPProgram(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, name] of Object.entries(IDSP_PROGRAM_DICT)) {
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
    const m = segment.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:cases?|deaths?|patients?|persons?|infected|confirmed|positive)/i)
           || segment.match(/(\d[\d,]*)\s+(?:new|total|reported|fresh|additional)/i);
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

function parseDateToISO(pubDate: string): string {
  if (!pubDate) return new Date().toISOString().split("T")[0];
  try { return new Date(pubDate).toISOString().split("T")[0]; } catch { return new Date().toISOString().split("T")[0]; }
}

/** Returns age of a date string in days (returns 999 if unparseable) */
function ageDays(isoDate: string): number {
  try {
    const ms = Date.now() - new Date(isoDate).getTime();
    return ms / 86_400_000;
  } catch { return 999; }
}

function makeItem(
  title: string, desc: string, link: string, pubDate: string,
  source: string, confidence: PHIntelligenceItem["confidence"]
): PHIntelligenceItem | null {
  const combined = `${title} ${desc}`;
  const disease  = detectIDSPDisease(combined);
  const program  = detectIDSPProgram(combined);
  if (!disease && !program) return null;

  const loc    = extractLocation(combined);
  const type: PHIntelligenceItem["type"]   = disease ? "Outbreak" : "Program";
  const cases  = extractNumber(combined, ["cases", "patients", "infected", "positive", "confirmed"]);
  const deaths = extractNumber(combined, ["deaths", "died", "fatalities", "killed"]);
  const date   = parseDateToISO(pubDate);

  return {
    type,
    category: "communicable",
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

// ── Source 1: PIB Health Ministry RSS ─────────────────────────────────────────
async function fetchPIBFeed(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch(
      "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
      { headers: { "User-Agent": "Vyasa/2.0 (+https://healthforindia.in)" }, redirect: "follow", next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return items;
    const xml   = await res.text();
    const itemRE = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRE.exec(xml)) !== null) {
      const b       = m[1];
      const title   = stripHtml(b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const desc    = stripHtml(b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? b.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
      if (!title) continue;
      const item = makeItem(title, desc, link, pubDate, "PIB (Press Information Bureau)", "High");
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items.slice(0, 25);
}

// ── Source 2: MoHFW headlines ──────────────────────────────────────────────────
async function fetchMoHFWAlerts(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch(
      "https://www.mohfw.gov.in/",
      { headers: { "User-Agent": "Vyasa/2.0" }, next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return items;
    const html   = await res.text();
    const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRE.exec(html)) !== null) {
      const text = stripHtml(m[2]);
      const href = m[1];
      if (text.length < 20 || text.length > 320) continue;
      const lower = text.toLowerCase();
      if (!/health|disease|outbreak|vaccine|epidemic|virus|bacteria|infection|surveillance/.test(lower)) continue;
      const item = makeItem(text, text, href.startsWith("http") ? href : `https://www.mohfw.gov.in${href}`, "", "MoHFW (Ministry of Health)", "High");
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items.slice(0, 12);
}

// ── Source 3: data.gov.in IDSP API (historical reference — treated as Low confidence if old)
async function fetchDataGovIDSP(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  if (!GOV_KEY) return items;
  const resources = [
    { id: "9ef84268-d588-465a-a308-a864a43d0070", label: "IDSP Weekly Surveillance" },
    { id: "2b4e3be5-18c0-4a95-98f6-57c4285ea9aa", label: "IDSP Annual Burden" },
    { id: "7a4e8e86-4f12-4c36-bc56-a0b764d5e97d", label: "IDSP Outbreak Reports" },
  ];
  for (const { id, label } of resources) {
    try {
      const url = `${BASE}/${id}?api-key=${GOV_KEY}&format=json&limit=50`;
      const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data    = await res.json();
      const records: Record<string, string>[] = data.records ?? [];
      if (!records.length) continue;

      for (const r of records.slice(0, 20)) {
        const disease  = r.disease ?? r.disease_name ?? r.name ?? "";
        const state    = r.state ?? r.state_ut ?? r.state_name ?? "";
        const district = r.district ?? r.district_name ?? "";
        const cases    = parseInt(r.cases ?? r.total_cases ?? r.human_cases ?? "0") || 0;
        const deaths   = parseInt(r.deaths ?? r.total_deaths ?? r.human_deaths ?? "0") || 0;
        const year     = r.year ?? r.report_year ?? r.report_date ?? "";
        if (!disease || !state) continue;

        const normalized = detectIDSPDisease(disease) || disease;
        const recordYear = parseInt(String(year).slice(0, 4)) || 0;
        // Records more than 2 years old are historical reference only
        const isRecent = recordYear >= CURRENT_YEAR - 1;
        const isoDate = year ? `${String(year).slice(0, 4)}-01-01` : new Date().toISOString().split("T")[0];

        items.push({
          type:     "Outbreak",
          category: "communicable",
          title:    `${normalized} — ${state}${district ? `, ${district}` : ""}${!isRecent ? ` (${recordYear})` : ""}`,
          disease:  normalized,
          location: { state, district, village: "" },
          summary:  `IDSP surveillance (${label}): ${cases > 0 ? cases.toLocaleString() + " cases" : "cases recorded"}${deaths > 0 ? `, ${deaths} deaths` : ""} of ${normalized} in ${state}${year ? ` (${year})` : ""}.`,
          cases:    cases  > 0 ? String(cases)  : "",
          deaths:   deaths > 0 ? String(deaths) : "",
          date:     isoDate,
          source:   `IDSP / data.gov.in (${label})`,
          confidence: isRecent ? "High" : "Low",
        });
      }
      if (items.length >= 10) break;
    } catch { continue; }
  }
  return items;
}

// ── Source 4: NHP / NCDC disease surveillance scraping ───────────────────────
async function fetchNHPNCDC(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const urls = [
    { url: "https://ncdc.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3752", src: "NCDC Disease Alerts" },
    { url: "https://nhp.gov.in/disease-surveillance_pg.htm",                          src: "NHP Disease Surveillance" },
    { url: "https://nhp.gov.in/healthnotification_pg.htm",                            src: "NHP Health Notification" },
  ];
  for (const { url, src } of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0" },
        next:    { revalidate: 0 },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRE.exec(html)) !== null) {
        const text = stripHtml(m[2]);
        if (text.length < 15 || text.length > 300) continue;
        const disease = detectIDSPDisease(text);
        const program = detectIDSPProgram(text);
        if (!disease && !program) continue;
        const loc  = extractLocation(text);
        const href = m[1];
        items.push({
          type:     disease ? "Outbreak" : "Program",
          category: "communicable",
          title:    text.slice(0, 130),
          disease:  disease || undefined,
          program:  program || undefined,
          location: loc,
          summary:  text,
          cases: "", deaths: "",
          date:     new Date().toISOString().split("T")[0],
          source:   src,
          sourceUrl: href.startsWith("http") ? href : `https://nhp.gov.in${href}`,
          confidence: "Medium",
        });
        if (items.length >= 10) break;
      }

      const rowRE  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rm: RegExpExecArray | null;
      let rowIdx = 0;
      while ((rm = rowRE.exec(html)) !== null && items.length < 15) {
        rowIdx++;
        if (rowIdx < 2) continue;
        const cells: string[] = [];
        const cellRE = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cm: RegExpExecArray | null;
        while ((cm = cellRE.exec(rm[1])) !== null) cells.push(stripHtml(cm[1]));
        if (cells.length < 2) continue;
        const rowText = cells.join(" ");
        const disease = detectIDSPDisease(rowText);
        if (!disease) continue;
        const loc = extractLocation(rowText);
        items.push({
          type: "Outbreak", category: "communicable",
          title:    `${disease} — ${loc.state || "India"}`,
          disease,
          location: loc,
          summary:  rowText.slice(0, 240),
          cases:    cells.find(c => /^\d[\d,]*$/.test(c.trim())) ?? "",
          deaths:   "",
          date:     new Date().toISOString().split("T")[0],
          source:   src,
          confidence: "Medium",
        });
      }

      if (items.length >= 5) break;
    } catch { continue; }
  }
  return items.slice(0, 15);
}

// ── Generic RSS parser ─────────────────────────────────────────────────────────
async function fetchRSS(
  url: string,
  sourceName: string,
  confidence: PHIntelligenceItem["confidence"],
  maxItems = 12,
  indiaFilter = true,
): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Vyasa/2.0 (+https://healthforindia.in)" },
      next:    { revalidate: 0 },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return items;
    const xml    = await res.text();
    const itemRE = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRE.exec(xml)) !== null && items.length < maxItems) {
      const b       = m[1];
      const title   = stripHtml(b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const desc    = stripHtml(b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? b.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
      const link    = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "").trim();
      const pubDate = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
      if (!title) continue;
      const combined = `${title} ${desc}`;
      if (indiaFilter && !/india/i.test(combined) && !extractLocation(combined).state) continue;
      const item = makeItem(title, desc, link, pubDate, sourceName, confidence);
      if (item) items.push(item);
    }
  } catch { /* silent */ }
  return items;
}

// ── Source 5: Google News RSS — India disease outbreaks ────────────────────────
async function fetchGoogleNewsIDSP(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const yr = CURRENT_YEAR;
  const queries = [
    `India+IDSP+disease+outbreak+epidemic+${yr}`,
    `India+dengue+malaria+cholera+outbreak+${yr}`,
    `India+nipah+mpox+disease+alert+health+${yr}`,
    `India+influenza+H1N1+H3N2+bird+flu+${yr}`,
    `India+leptospirosis+typhoid+scrub+typhus+${yr}`,
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
        const item = makeItem(title, desc, link, pubDate, "Google News (India Health)", "Medium");
        if (item) items.push(item);
      }
      if (items.length >= 10) break;
    } catch { continue; }
  }
  return items.slice(0, 15);
}

// ── Source 6: Outbreak News Today RSS ─────────────────────────────────────────
async function fetchOutbreakNewsFeed(): Promise<PHIntelligenceItem[]> {
  return fetchRSS("https://outbreaknewstoday.com/feed/", "Outbreak News Today", "Medium", 8, true);
}

// ── Source 7: The Hindu Health RSS ────────────────────────────────────────────
async function fetchTheHinduHealth(): Promise<PHIntelligenceItem[]> {
  return fetchRSS(
    "https://www.thehindu.com/sci-tech/health/feeder/default.rss",
    "The Hindu Health",
    "High",
    12,
    false,  // The Hindu is India-based, no India filter needed
  );
}

// ── Source 8: Indian Express Health RSS ──────────────────────────────────────
async function fetchIndianExpressHealth(): Promise<PHIntelligenceItem[]> {
  return fetchRSS(
    "https://indianexpress.com/section/health/feed/",
    "Indian Express Health",
    "High",
    20,
    false,
  );
}

// ── Source 9: WHO News (India-filtered) ───────────────────────────────────────
async function fetchWHONews(): Promise<PHIntelligenceItem[]> {
  const feeds = [
    "https://www.who.int/rss-feeds/news-releases.xml",
  ];
  const items: PHIntelligenceItem[] = [];
  for (const url of feeds) {
    const batch = await fetchRSS(url, "WHO Disease Outbreak News", "High", 10, true);
    items.push(...batch);
    if (items.length >= 8) break;
  }
  return items.slice(0, 8);
}

// ── Source 10: WHO India + SEARO outbreak alerts ──────────────────────────────
async function fetchWHOIndia(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const endpoints = [
    { url: "https://www.searo.who.int/india/en/", src: "WHO India (SEARO)" },
    { url: "https://www.who.int/southeastasia/outbreaks-and-emergencies", src: "WHO SEARO Outbreaks" },
    { url: "https://www.who.int/india/news-releases", src: "WHO India News" },
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
        const disease = detectIDSPDisease(text);
        const program = detectIDSPProgram(text);
        if (!disease && !program) continue;
        const loc  = extractLocation(text);
        const href = m[1];
        items.push({
          type: disease ? "Outbreak" : "Program",
          category: "communicable",
          title:    text.slice(0, 130),
          disease:  disease || undefined,
          program:  program || undefined,
          location: loc,
          summary:  text,
          cases: "", deaths: "",
          date:     new Date().toISOString().split("T")[0],
          source:   src,
          sourceUrl: href.startsWith("http") ? href : `https://www.who.int${href}`,
          confidence: "High",
        });
      }
    } catch { continue; }
    if (items.length >= 8) break;
  }
  return items.slice(0, 10);
}

// ── Source 11: NCDC outbreak bulletin scraping ────────────────────────────────
async function fetchNCDCOutbreaks(): Promise<PHIntelligenceItem[]> {
  const items: PHIntelligenceItem[] = [];
  const urls = [
    { url: "https://ncdc.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3749", src: "NCDC Outbreak Alerts" },
    { url: "https://ncdc.mohfw.gov.in/",                                               src: "NCDC (National Centre for Disease Control)" },
  ];
  for (const { url, src } of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Vyasa/2.0" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const linkRE = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRE.exec(html)) !== null && items.length < 12) {
        const text = stripHtml(m[2]);
        if (text.length < 15 || text.length > 280) continue;
        const disease = detectIDSPDisease(text);
        const program = detectIDSPProgram(text);
        if (!disease && !program) continue;
        const loc = extractLocation(text);
        const href = m[1];
        items.push({
          type: disease ? "Outbreak" : "Program",
          category: "communicable",
          title:    text.slice(0, 130),
          disease:  disease || undefined,
          program:  program || undefined,
          location: loc,
          summary:  text,
          cases: "", deaths: "",
          date:     new Date().toISOString().split("T")[0],
          source:   src,
          sourceUrl: href.startsWith("http") ? href : `https://ncdc.mohfw.gov.in${href}`,
          confidence: "High",
        });
      }
    } catch { continue; }
    if (items.length >= 10) break;
  }
  return items.slice(0, 12);
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
export async function runIDSPAgent(): Promise<{
  items:       PHIntelligenceItem[];
  sources:     string[];
  errors:      string[];
}> {
  const errors:  string[] = [];
  const sources: string[] = [];

  const results = await Promise.allSettled([
    fetchPIBFeed(),
    fetchMoHFWAlerts(),
    fetchDataGovIDSP(),
    fetchNHPNCDC(),
    fetchGoogleNewsIDSP(),
    fetchOutbreakNewsFeed(),
    fetchTheHinduHealth(),
    fetchIndianExpressHealth(),
    fetchWHONews(),
    fetchWHOIndia(),
    fetchNCDCOutbreaks(),
  ]);

  const labels = [
    "PIB", "MoHFW", "IDSP data.gov.in", "NHP/NCDC",
    "Google News", "Outbreak News Today",
    "The Hindu Health", "Indian Express Health", "WHO News",
    "WHO India/SEARO", "NCDC Outbreaks",
  ];

  const all: PHIntelligenceItem[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      if (r.value.length) sources.push(`${labels[i]} (${r.value.length})`);
    } else {
      errors.push(`${labels[i]}: ${r.reason}`);
    }
  });

  // Recency score: items in the last 30 days get a boost; last 7 days get a bigger boost
  const confScore = { High: 3, Medium: 2, Low: 1 } as const;
  const typeScore: Record<string, number> = {
    Outbreak: 4, Program: 3, Policy: 2, Infrastructure: 1, NCD: 0,
  };

  const sorted = dedup(all)
    .filter(item => ageDays(item.date ?? "") <= 30)
    .sort((a, b) => {
      const c = (confScore[b.confidence] ?? 0) - (confScore[a.confidence] ?? 0);
      if (c !== 0) return c;
      const t = (typeScore[b.type] ?? 0) - (typeScore[a.type] ?? 0);
      if (t !== 0) return t;
      return (b.date ?? "").localeCompare(a.date ?? "");
    });

  return { items: sorted.slice(0, 70), sources, errors };
}
