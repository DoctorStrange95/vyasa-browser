"use client";
import { useState } from "react";
import Link from "next/link";

export interface StateStatRow {
  state: string;
  slug: string;
  outbreaks: number;
  cases: number;
  deaths: number;
  districts: { district: string; outbreaks: number; cases: number; deaths: number }[];
}

export default function IDSPStateBurden({ rows }: { rows: StateStatRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#0a1628" }}>
            {["State", "Outbreaks", "Cases", "Deaths"].map(h => (
              <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", color: "#475569", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ state, slug, outbreaks, cases, deaths, districts }, i) => {
            const isOpen = selected === state;
            return (
              <>
                <tr
                  key={state}
                  onClick={() => setSelected(isOpen ? null : state)}
                  style={{
                    backgroundColor: isOpen ? "#0f2040" : (i % 2 === 0 ? "#0f172a" : "#0a1020"),
                    borderTop: "1px solid #1e293b",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#162033"; }}
                  onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = i % 2 === 0 ? "#0f172a" : "#0a1020"; }}
                >
                  <td style={{ padding: "0.55rem 0.85rem", color: isOpen ? "#93c5fd" : "#e2e8f0", fontWeight: isOpen ? 600 : 400 }}>
                    <span style={{ marginRight: "0.4rem", fontSize: "0.6rem", color: "#475569", verticalAlign: "middle" }}>
                      {isOpen ? "▼" : "▶"}
                    </span>
                    <Link
                      href={`/state/${slug}`}
                      onClick={e => e.stopPropagation()}
                      style={{ color: isOpen ? "#93c5fd" : "#93c5fd", textDecoration: "none" }}
                    >
                      {state}
                    </Link>
                  </td>
                  <td style={{ padding: "0.55rem 0.85rem", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>{outbreaks}</td>
                  <td style={{ padding: "0.55rem 0.85rem", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace" }}>{cases.toLocaleString()}</td>
                  <td style={{ padding: "0.55rem 0.85rem", color: deaths > 0 ? "#ef4444" : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{deaths}</td>
                </tr>
                {isOpen && (
                  <tr key={`${state}-detail`} style={{ backgroundColor: "#080f1e" }}>
                    <td colSpan={4} style={{ padding: "0", borderTop: "1px solid #1e3a5f" }}>
                      <div style={{ padding: "0.75rem 1rem 0.75rem 1.75rem" }}>
                        <div style={{ fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
                          Districts with outbreaks in {state}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {districts.map(d => (
                            <div key={d.district} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.3rem 0.5rem", borderRadius: "6px", backgroundColor: "#0f172a" }}>
                              <span style={{ color: "#e2e8f0", fontSize: "0.78rem", minWidth: "140px" }}>{d.district || "—"}</span>
                              <span style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" }}>
                                {d.outbreaks} outbreak{d.outbreaks !== 1 ? "s" : ""}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "#fb923c", fontFamily: "'IBM Plex Mono', monospace" }}>
                                {d.cases.toLocaleString()} cases
                              </span>
                              {d.deaths > 0 && (
                                <span style={{ fontSize: "0.72rem", color: "#ef4444", fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {d.deaths} deaths
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
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
  );
}
