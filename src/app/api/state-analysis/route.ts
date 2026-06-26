import { NextRequest } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "GROQ_API_KEY not set" }), { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { name, level = "state", metrics = {} } = body as {
    name: string;
    level: "state" | "district";
    metrics: Record<string, number | null | string>;
  };

  const lines: string[] = [];
  if (metrics.imr       != null) lines.push(`IMR: ${metrics.imr}/1000 LB (national avg 28)`);
  if (metrics.neonatalMR!= null) lines.push(`Neonatal MR: ${metrics.neonatalMR}/1000 LB`);
  if (metrics.under5MR  != null) lines.push(`Under-5 MR: ${metrics.under5MR}/1000 LB`);
  if (metrics.vaccPct   != null) lines.push(`Full vaccination: ${metrics.vaccPct}% (national 82.6%)`);
  if (metrics.stuntingPct!= null) lines.push(`Stunting: ${metrics.stuntingPct}% (national 29.3%)`);
  if (metrics.wastingPct!= null) lines.push(`Wasting: ${metrics.wastingPct}%`);
  if (metrics.underweightPct!= null) lines.push(`Underweight: ${metrics.underweightPct}%`);
  if (metrics.instBirths!= null) lines.push(`Institutional births: ${metrics.instBirths}%`);
  if (metrics.womenAnaemia!= null) lines.push(`Women's anaemia: ${metrics.womenAnaemia}%`);
  if (metrics.anaemia   != null) lines.push(`Children's anaemia: ${metrics.anaemia}%`);
  if (metrics.birthRate != null) lines.push(`Birth rate: ${metrics.birthRate}/1000 population`);
  if (metrics.deathRate != null) lines.push(`Death rate: ${metrics.deathRate}/1000 population`);
  if (metrics.phcTotal  != null) lines.push(`PHCs: ${metrics.phcTotal} | CHCs: ${metrics.chcTotal ?? "—"}`);
  if (metrics.aqi       != null) lines.push(`AQI: ${metrics.aqi} (${metrics.aqiLabel ?? ""})`);
  if (metrics.healthScore!= null) lines.push(`Composite health score: ${metrics.healthScore}/100`);

  const prompt = `You are a public health intelligence analyst for India. Provide a brief, focused health intelligence brief for ${name} ${level}.

Health data:
${lines.join("\n")}

Respond in this exact structure (use markdown, be specific and data-driven, under 200 words total):

## Health Intelligence Brief — ${name}

**Overall Assessment:** [1 sentence: is this state performing above/below national average, overall status]

**Key Strengths:** [2 bullet points — best performing metrics with numbers]

**Critical Gaps:** [2 bullet points — worst performing metrics, specific numbers vs national average]

**Priority Action:** [1 sentence: single most impactful intervention for this state based on data]

Risk level: **[High / Medium / Low / Monitoring]**`;

  const client = new Groq({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groqStream = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 400,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        });
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Groq error";
        controller.enqueue(encoder.encode(`\n\n*Analysis unavailable: ${msg}*`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
