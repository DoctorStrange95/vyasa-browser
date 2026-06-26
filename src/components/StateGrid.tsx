"use client";
import { useState } from "react";
import Link from "next/link";

interface State {
  slug: string;
  name: string;
  imr: number | null;
  neonatalMR: number | null;
  under5MR: number | null;
  vaccinationPct: number | null;
  stuntingPct: number | null;
  underweightPct: number | null;
  wastingPct: number | null;
  institutionalBirthsPct: number | null;
  anaemiaPct: number | null;
  womenAnaemiaPct: number | null;
}

const SORT_OPTIONS = [
  { value: "name",          label: "Name (A–Z)" },
  { value: "imr",           label: "IMR (best first)" },
  { value: "vaccination",   label: "Vaccination % (best)" },
  { value: "stunting",      label: "Stunting % (lowest)" },
  { value: "under5",        label: "Under-5 MR (best)" },
  { value: "instBirths",    label: "Institutional Births" },
];

function scoreColor(v: number | null, best: number, worst: number, higher: boolean): string {
  if (v === null) return "#475569";
  const good = higher ? v >= best : v <= best;
  const bad  = higher ? v <= worst : v >= worst;
  return good ? "#22c55e" : bad ? "#ef4444" : "#eab308";
}

export default function StateGrid({ states }: { states: State[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort]   = useState("name");

  const filtered = states
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name")        return a.name.localeCompare(b.name);
      if (sort === "imr")         return (a.imr ?? 99) - (b.imr ?? 99);
      if (sort === "vaccination") return (b.vaccinationPct ?? 0) - (a.vaccinationPct ?? 0);
      if (sort === "stunting")    return (a.stuntingPct ?? 99) - (b.stuntingPct ?? 99);
      if (sort === "under5")      return (a.under5MR ?? 99) - (b.under5MR ?? 99);
      if (sort === "instBirths")  return (b.institutionalBirthsPct ?? 0) - (a.institutionalBirthsPct ?? 0);
      return 0;
    });

  return (
    <section id="states" style={{ maxWidth: "1280px", margin: "0 auto", padding: "4rem 1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "1.5rem", marginBottom: "2rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "2rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
            States &amp; Union Territories
          </h2>
          <p style={{ fontSize: "0.88rem", color: "#64748b" }}>
            {filtered.length} of {states.length} · NFHS-6 (2023-24) · Click any state to explore districts &amp; live AQI
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "8px",
              padding: "0.5rem 0.9rem", color: "#e2e8f0", fontSize: "0.85rem",
              outline: "none", width: "200px", fontFamily: "inherit",
            }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "8px",
              padding: "0.5rem 0.9rem", color: "#94a3b8", fontSize: "0.85rem",
              outline: "none", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#475569" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔍</div>
          <p>No states match &quot;{query}&quot;</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {filtered.map((s) => <StateCard key={s.slug} state={s} />)}
        </div>
      )}
    </section>
  );
}

function StateCard({ state }: { state: State }) {
  const imrCol   = scoreColor(state.imr, 20, 40, false);
  const vacCol   = scoreColor(state.vaccinationPct, 85, 60, true);
  const stunCol  = scoreColor(state.stuntingPct, 20, 40, false);
  const u5Col    = scoreColor(state.under5MR, 25, 50, false);
  const wwtCol   = scoreColor(state.womenAnaemiaPct, 30, 55, false);

  return (
    <Link href={`/state/${state.slug}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "#0f2040", border: "1px solid #1e3a5f",
          borderRadius: "12px", padding: "1.5rem", cursor: "pointer",
          transition: "border-color 0.2s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#0d9488";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#1e3a5f";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Name */}
        <div style={{ marginBottom: "1rem" }}>
          <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>{state.name}</div>
          <div style={{ fontSize: "0.68rem", color: "#475569", marginTop: "0.15rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            NFHS-6 · 2023-24
          </div>
        </div>

        {/* Row 1: IMR, Vacc, Stunt, Under-5 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <MiniStat label="IMR" value={state.imr !== null ? String(state.imr) : "—"} color={imrCol} unit="/k" />
          <MiniStat label="Vacc%" value={state.vaccinationPct !== null ? `${state.vaccinationPct}` : "—"} color={vacCol} />
          <MiniStat label="Stunt%" value={state.stuntingPct !== null ? `${state.stuntingPct}` : "—"} color={stunCol} />
          <MiniStat label="U5-MR" value={state.under5MR !== null ? `${state.under5MR}` : "—"} color={u5Col} unit="/k" />
        </div>

        {/* Row 2: Anaemia, Underweight, Wasting, Inst Births */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
          <MiniStat label="C.Anaem%" value={state.anaemiaPct !== null ? `${state.anaemiaPct}` : "—"} color={scoreColor(state.anaemiaPct, 40, 70, false)} />
          <MiniStat label="Unwt%" value={state.underweightPct !== null ? `${state.underweightPct}` : "—"} color={scoreColor(state.underweightPct, 20, 40, false)} />
          <MiniStat label="Wast%" value={state.wastingPct !== null ? `${state.wastingPct}` : "—"} color={scoreColor(state.wastingPct, 10, 20, false)} />
          <MiniStat label="W.Anaem%" value={state.womenAnaemiaPct !== null ? `${state.womenAnaemiaPct}` : "—"} color={wwtCol} />
        </div>

        {/* Vaccination coverage bar */}
        {state.vaccinationPct !== null && (
          <div style={{ marginBottom: "0.55rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#475569", marginBottom: "0.2rem" }}>
              <span>Vaccination coverage</span>
              <span style={{ color: vacCol }}>{state.vaccinationPct}%</span>
            </div>
            <div style={{ height: "3px", backgroundColor: "#1e3a5f", borderRadius: "2px" }}>
              <div style={{ height: "100%", width: `${state.vaccinationPct}%`, backgroundColor: vacCol, borderRadius: "2px" }} />
            </div>
          </div>
        )}

        {/* IMR risk bar (inverted — lower is better, so wider bar = higher risk) */}
        {state.imr !== null && (
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#475569", marginBottom: "0.2rem" }}>
              <span>IMR risk level</span>
              <span style={{ color: imrCol }}>{state.imr}/1000 LB</span>
            </div>
            <div style={{ height: "3px", backgroundColor: "#1e3a5f", borderRadius: "2px" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (state.imr / 60) * 100)}%`, backgroundColor: imrCol, borderRadius: "2px" }} />
            </div>
          </div>
        )}

        <div style={{ fontSize: "0.78rem", color: "#0d9488", fontWeight: 600 }}>
          View districts &amp; live AQI →
        </div>
      </div>
    </Link>
  );
}

function MiniStat({ label, value, color, unit = "" }: { label: string; value: string; color: string; unit?: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.6rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.1rem" }}>{label}</div>
      <div className="font-data" style={{ fontSize: "0.9rem", fontWeight: 600, color }}>
        {value}{unit && value !== "—" ? <span style={{ fontSize: "0.65rem", color: "#475569" }}>{unit}</span> : ""}
      </div>
    </div>
  );
}
