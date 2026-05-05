import { NextRequest } from "next/server";
import Groq from "groq-sdk";

// Strip HTML and clean extracted article text
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

// Allowlist of trusted public news/health domains — no internal or metadata endpoints
const ALLOWED_FETCH_HOSTS = new Set([
  "www.who.int", "who.int",
  "mohfw.gov.in", "www.mohfw.gov.in",
  "idsp.mohfw.gov.in",
  "pib.gov.in", "www.pib.gov.in",
  "icmr.gov.in", "www.icmr.gov.in",
  "nhm.gov.in", "www.nhm.gov.in",
  "niti.gov.in", "www.niti.gov.in",
  "thehindu.com", "www.thehindu.com",
  "hindustantimes.com", "www.hindustantimes.com",
  "timesofindia.com", "www.timesofindia.com", "timesofindia.indiatimes.com",
  "ndtv.com", "www.ndtv.com",
  "indianexpress.com", "www.indianexpress.com",
  "theprint.in", "www.theprint.in",
  "scroll.in", "www.scroll.in",
  "wire.in", "www.wire.in", "thewire.in",
  "livemint.com", "www.livemint.com",
  "businessstandard.com", "www.businessstandard.com",
  "telegraphindia.com", "www.telegraphindia.com",
  "deccanherald.com", "www.deccanherald.com",
  "thestatesman.com", "www.thestatesman.com",
  "outbreaknewstoday.com", "www.outbreaknewstoday.com",
  "promedmail.org", "www.promedmail.org",
  "healthforindia.in", "www.healthforindia.in",
  "vyasaa.com", "www.vyasaa.com",
]);

// Best-effort article fetch — returns empty string on any failure
async function fetchArticleText(url: string): Promise<string> {
  if (!url) return "";
  let parsed: URL;
  try { parsed = new URL(url); } catch { return ""; }
  // Only allow https and known public news/health hosts
  if (parsed.protocol !== "https:") return "";
  if (!ALLOWED_FETCH_HOSTS.has(parsed.hostname)) return "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Vyasa/2.0; +https://healthforindia.in)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain") && !ct.includes("application/xhtml")) return "";
    const html = await res.text();
    return extractText(html);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "GROQ_API_KEY not configured. Get a free key at https://console.groq.com and add it to .env.local.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    title = "", summary = "", disease = "", program = "", source = "",
    sourceUrl = "", cases = "", deaths = "", location = {}, category = "",
    priority = "", date = "",
  } = body;

  const articleText = await fetchArticleText(sourceUrl);

  const state    = location.state    || "India";
  const district = location.district || "";
  const locationStr = [state, district, location.village].filter(Boolean).join(", ");

  const topic    = disease || program || title || "Not specified";
  const catNorm  = category.toLowerCase();
  const catLabel = catNorm === "ncd" ? "NCD"
                 : catNorm === "outbreak" || catNorm === "communicable" ? "OUTBREAK"
                 : catNorm === "program" || catNorm === "programme" ? "PROGRAM"
                 : catNorm === "policy" || catNorm === "guideline" ? "POLICY"
                 : "OUTBREAK";

  const articleBlock = articleText
    ? `\nARTICLE CONTENT (extracted):\n${articleText}`
    : `\nNote: Article content could not be fetched — use metadata only.`;

  /* ── Category-specific prose instructions ────────────────────────── */
  const instructionByCategory: Record<string, string> = {

    OUTBREAK: `Write a flowing 2–3 paragraph intelligence brief in the style of a WHO Disease Outbreak News or IDSP Rapid Risk Assessment.

Paragraph 1 — Situation: Open with **${state}${district ? ", " + district : ""}** in bold, then in one or two sentences describe what is happening: the disease, where, how many cases and deaths (state exact numbers or "case count not disclosed"), and when it started. If cases or deaths are not specified, say so — do not invent.

Paragraph 2 — Epidemiology & response: Cover the affected area (districts, blocks, radius), any high-risk groups, the timeline of spread, and what containment measures are under way (culling, quarantine, contact tracing, vaccination drives). Include CFR if both cases and deaths are known: (deaths÷cases)×100%.

Paragraph 3 — Significance & actions needed: Note whether this is unusual for the season or location. Flag any baseline comparison if inferable ("first detected in this district", "above seasonal average"). Close with one or two specific surveillance or prevention actions that district health officers should prioritise.

Use no section headings. Write as continuous prose. Be specific — numbers over adjectives.`,

    NCD: `Write a flowing 2–3 paragraph intelligence brief in the style of an ICMR epidemiology bulletin or NPCDCS state-level briefing note.

Paragraph 1 — Burden snapshot: State the condition, location (${locationStr}), prevalence or absolute numbers from the source, and which population is most affected (age band, sex, urban/rural). Cite the baseline or comparison period if available; otherwise note the gap.

Paragraph 2 — Trend & risk profile: Describe whether burden is rising, stable, or declining versus the previous year or national average. Name the primary risk factors mentioned in the source. If high-risk sub-groups are identified, be specific.

Paragraph 3 — Actionable implications: Give one concrete clinical recommendation for frontline doctors (e.g., "Screen adults over 40 for CKD in coastal ${state}"). Note any screening program gaps, treatment access barriers, or prevention opportunities the source highlights.

Use no section headings. Write as continuous prose. Be specific and actionable.`,

    PROGRAM: `Write a focused 2-paragraph programme brief in the style of a National Health Mission state-level circular summary.

Paragraph 1 — What and why: Name the programme or initiative, the organisation behind it, and in one sentence what it does. Then describe the specific public health problem it addresses, who it targets (patients, health workers, administrators, researchers), and any measurable outcomes stated in the source.

Paragraph 2 — What frontline staff need to know: Cover key dates (application deadline, implementation window, eligibility criteria). Close with a direct statement on clinical or operational impact — either "No immediate change to clinical practice" or exactly what changes for PHC or district hospital staff.

Use no section headings. Write as continuous prose.`,

    POLICY: `Write a focused 2-paragraph policy brief in the style of a Ministry of Health & Family Welfare office memorandum summary.

Paragraph 1 — What changed: Describe the previous guideline or baseline (or note this is new), what the revised policy now mandates, and when it takes effect. Be specific about the drug, protocol, notification form, or threshold that changed.

Paragraph 2 — Ground-level impact and compliance: Explain what this means day-to-day for PHC and district hospital staff — updated reporting timelines, revised treatment protocols, new surveillance obligations. State any compliance deadline explicitly, or note "No compliance deadline specified" if the source does not mention one.

Use no section headings. Write as continuous prose. Extract only what changes practice.`,
  };

  const instruction = instructionByCategory[catLabel] ?? instructionByCategory.OUTBREAK;

  const prompt = `You are a public health intelligence analyst writing briefings for Indian district and state health officers.

ITEM METADATA:
Category: ${catLabel}
Disease/Topic: ${topic}
Title: ${title}
Source: ${source}
Location: ${locationStr}
Date: ${date || "Not specified"}
Priority: ${priority || "Standard"}
Reported cases: ${cases || "not disclosed"}
Reported deaths: ${deaths || "not disclosed"}
Existing summary: ${summary || "—"}
${articleBlock}

---

WRITING INSTRUCTIONS:
${instruction}

RULES (all categories):
- Use exact numbers from the source. Never fabricate figures.
- Flag missing data explicitly: "case count not disclosed in source".
- No markdown headers, no bullet lists, no bold section labels like KEY FACTS or CONTEXT.
- Bold only proper nouns and location names where it aids quick scanning.
- Under 300 words total. Every sentence must earn its place.`;

  const client = new Groq({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groqStream = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1500,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Groq API error";
        controller.enqueue(encoder.encode(`\n\n**Error:** ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
