"use client";
import { useState } from "react";
import Link from "next/link";

export interface StateWeekCell {
  outbreaks: number;
  cases: number;
  deaths: number;
  dateRange?: string;
  diseases?: string[];
}

export interface StateRow {
  state: string;
  slug: string;
  total: { outbreaks: number; cases: number; deaths: number };
  // keyed by week number
  byWeek: Record<number, StateWeekCell>;
  diseases: string[];
}

interface Props {
  stateRows: StateRow[];
  weeks: number[];      // sorted ascending, e.g. [1,2,...,15]
  year: number;
}

function heatColor(cases: number, max: number): string {
  if (cases === 0 || max === 0) return "transparent";
  const pct = Math.min(cases / max, 1);
  if (pct < 0.1)  return "#134e4a40";
  if (pct < 0.25) return "#0d948870";
  if (pct < 0.45) return "#f9731640";
  if (pct < 0.65) return "#f9731699";
  if (pct < 0.85) return "#ef4444aa";
  return "#ef4444ff";
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default function IDSPStateGrid({ stateRows, weeks, year }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"cases" | "outbreaks">("cases");

  const maxCellVal = Math.max(
    ...stateRows.flatMap(r => weeks.map(w => view === "cases" ? (r.byWeek[w]?.cases ?? 0) : (r.byWeek[w]?.outbreaks ?? 0))),
    1,
  );

  function toggle(state: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(state) ? next.delete(state) : next.add(state);
      return next;
    });
  }

  const cellW = Math.max(32, Math.floor(560 / Math.max(weeks.length, 1)));

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Heat map shows:</span>
        {(["cases", "outbreaks"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: "0.72rem", padding: "0.25rem 0.7rem", borderRadius: "20px", cursor: "pointer",
            backgroundColor: view === v ? "#f9731620" : "transparent",
            border: `1px solid ${view === v ? "#f97316" : "#1e293b"}`,
            color: view === v ? "#f97316" : "#64748b",
          }}>
            {v === "cases" ? "Cases" : "Outbreaks"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#334155" }}>
          Click a row to see week-by-week detail
        </span>
      </div>

      {/* Heat map table */}
      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #1e293b" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.75rem", minWidth: "max-content", width: "100%" }}>
          <thead>
            <tr style={{ backgroundColor: "#0a1628" }}>
              <th style={{ padding: "0.6rem 1rem", textAlign: "left", color: "#475569", fontWeight: 600, position: "sticky", left: 0, backgroundColor: "#0a1628", zIndex: 1, minWidth: "140px" }}>
                State / UT
              </th>
              {weeks.map(w => (
                <th key={w} style={{ padding: "0.5rem", textAlign: "center", color: "#475569", fontWeight: 600, width: `${cellW}px`, minWidth: `${cellW}px` }}>
                  W{w}
                </th>
              ))}
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "right", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                YTD Total
              </th>
            </tr>
          </thead>
          <tbody>
            {stateRows.map((row, i) => {
              const isOpen = expanded.has(row.state);
              const rowBg = i % 2 === 0 ? "#0f172a" : "#0a1020";
              return (
                <>
                  {/* Summary row */}
                  <tr key={row.state} style={{ backgroundColor: rowBg, borderTop: "1px solid #1e293b", cursor: "pointer" }}
                    onClick={() => toggle(row.state)}>
                    <td style={{
                      padding: "0.55rem 1rem", color: "#93c5fd", position: "sticky", left: 0,
                      backgroundColor: rowBg, zIndex: 1, whiteSpace: "nowrap",
                    }}>
                      <span style={{ marginRight: "0.4rem", fontSize: "0.65rem", color: isOpen ? "#f97316" : "#475569" }}>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {row.state}
                    </td>
                    {weeks.map(w => {
                      const cell = row.byWeek[w];
                      const val = view === "cases" ? (cell?.cases ?? 0) : (cell?.outbreaks ?? 0);
                      return (
                        <td key={w} style={{
                          padding: "0.4rem",
                          textAlign: "center",
                          backgroundColor: heatColor(val, maxCellVal),
                          color: val > 0 ? "#e2e8f0" : "#1e293b",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "0.7rem",
                          fontWeight: val > 0 ? 600 : 400,
                        }}>
                          {val > 0 ? val.toLocaleString() : "·"}
                        </td>
                      );
                    })}
                    <td style={{ padding: "0.55rem 0.85rem", textAlign: "right", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                      {view === "cases" ? row.total.cases.toLocaleString() : row.total.outbreaks}
                      {row.total.deaths > 0 && (
                        <span style={{ fontSize: "0.6rem", color: "#ef4444", marginLeft: "0.4rem" }}>
                          {row.total.deaths}☠
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isOpen && (
                    <tr key={`${row.state}-detail`} style={{ backgroundColor: "#060d1a", borderTop: "1px solid #1e3a5f" }}>
                      <td colSpan={weeks.length + 2} style={{ padding: "0" }}>
                        <div style={{ padding: "1rem 1.25rem 1.25rem" }}>
                          {/* State header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                            <div>
                              <Link href={`/state/${row.slug}`} style={{ color: "#93c5fd", fontWeight: 700, textDecoration: "none", fontSize: "0.88rem" }}>
                                {row.state} ↗
                              </Link>
                              <span style={{ fontSize: "0.7rem", color: "#475569", marginLeft: "0.6rem" }}>
                                {row.diseases.slice(0, 4).join(" · ")}
                                {row.diseases.length > 4 && ` +${row.diseases.length - 4} more`}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "1.25rem" }}>
                              {[
                                { label: "Outbreaks", val: row.total.outbreaks, color: "#f97316" },
                                { label: "Cases", val: row.total.cases.toLocaleString(), color: "#fb923c" },
                                { label: "Deaths", val: row.total.deaths, color: "#ef4444" },
                              ].map(s => (
                                <div key={s.label} style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: "1rem", fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.val}</div>
                                  <div style={{ fontSize: "0.6rem", color: "#475569" }}>{s.label} YTD</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Week-by-week detail table */}
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#0a1628" }}>
                                {["Week", "Date Range", "Outbreaks", "Cases this week", "Deaths", "Active diseases"].map(h => (
                                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#475569", fontWeight: 600 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {weeks.filter(w => row.byWeek[w]?.outbreaks > 0).map((w, j) => {
                                const cell = row.byWeek[w]!;
                                return (
                                  <tr key={w} style={{
                                    backgroundColor: j % 2 === 0 ? "#0a1020" : "#0f172a",
                                    borderTop: "1px solid #1e293b",
                                  }}>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                                      {ordinal(w)}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#475569", whiteSpace: "nowrap" }}>
                                      {cell.dateRange ?? "—"}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
                                      {cell.outbreaks}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                                      {cell.cases.toLocaleString()}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: cell.deaths > 0 ? "#ef4444" : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
                                      {cell.deaths}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", fontSize: "0.7rem" }}>
                                      {cell.diseases?.join(" · ") ?? "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.65rem", color: "#475569" }}>
        <span>Low</span>
        {["#134e4a40", "#0d948870", "#f9731640", "#f9731699", "#ef4444aa", "#ef4444ff"].map((c, i) => (
          <div key={i} style={{ width: 16, height: 12, backgroundColor: c, border: "1px solid #1e293b20", borderRadius: 2 }} />
        ))}
        <span>High</span>
        <span style={{ marginLeft: "0.5rem" }}>· = no cases reported</span>
      </div>
    </div>
  );
}
