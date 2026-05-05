"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VyasaLogo from "./VyasaLogo";
import type { UIConfig } from "@/lib/siteConfig";

export interface HeaderUser { name: string; email: string; }

interface SearchResult {
  type: "state" | "district";
  name: string;
  slug: string;
  extra?: string;
}

function useSearch() {
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const cacheRef = useRef<{ states: SearchResult[]; districts: SearchResult[] } | null>(null);

  const load = useCallback(async () => {
    if (cacheRef.current) return cacheRef.current;
    const [statesRes, citiesRes] = await Promise.all([
      fetch("/api/search-index?type=states").then(r => r.json()).catch(() => []),
      fetch("/api/search-index?type=districts").then(r => r.json()).catch(() => []),
    ]);
    cacheRef.current = { states: statesRes, districts: citiesRes };
    return cacheRef.current;
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    load().then(({ states, districts }) => {
      if (cancelled) return;
      const stateHits = states.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5);
      const distHits  = districts.filter(d => d.name.toLowerCase().includes(q) || (d.extra ?? "").toLowerCase().includes(q)).slice(0, 5);
      setResults([...stateHits, ...distHits].slice(0, 8));
    });
    return () => { cancelled = true; };
  }, [query, load]);

  return { query, setQuery, results };
}

export default function Header({ user, uiConfig }: { user?: HeaderUser | null; uiConfig?: UIConfig | null }) {
  const showForDoctors = uiConfig?.header.showForDoctors ?? true;
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const { query, setQuery, results } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  function close() { setSearchOpen(false); setQuery(""); }
  function go(r: SearchResult) {
    router.push(`/${r.type === "state" ? "state" : "district"}/${r.slug}`);
    close();
  }

  return (
    <header style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", position: "fixed", top: 0, left: 0, right: 0, zIndex: 200 }}>
      <div
        style={{
          maxWidth: "100%",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
          gap: "0.75rem",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <VyasaLogo size={36} />
          <div>
            <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
              Vyasa
            </div>
            <div style={{ fontSize: "0.65rem", color: "#2dd4bf", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Public Health Platform
            </div>
          </div>
        </Link>

        {/* Right-side actions */}
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>

          {/* Search button — icon always visible, text hidden on small phones */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search states and districts"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              backgroundColor: "#0f2040", border: "1px solid #1e3a5f",
              color: "#94a3b8", borderRadius: "8px",
              padding: "0.5rem 0.75rem",
              fontSize: "0.8rem", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
              minHeight: "44px", minWidth: "44px", whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
            <span className="header-search-label">Search</span>
          </button>

          {/* For professionals only */}
          {showForDoctors && (
            <Link
              href="/join#join-form"
              className="header-join-btn"
              title="Join Vyasa Health Platform — for healthcare professionals"
              style={{ backgroundColor: "#0d948815", border: "1px solid #0d948840", color: "#64748b", padding: "0.55rem 0.9rem", borderRadius: "6px", textDecoration: "none", fontSize: "0.82rem", fontWeight: 500, minHeight: "44px", display: "inline-flex", alignItems: "center" }}
            >
              For Doctors
            </Link>
          )}

          {user ? (
            <Link
              href="/profile"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "0.55rem 0.9rem", borderRadius: "6px", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600, minHeight: "44px" }}
            >
              <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#0d948840", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700 }}>
                {user.name[0].toUpperCase()}
              </span>
              <span className="header-username">{user.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link
              href="/auth"
              style={{ backgroundColor: "#0d9488", color: "#fff", padding: "0.6rem 1.25rem", borderRadius: "6px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700, minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            >
              Sign In →
            </Link>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            backgroundColor: "#00000080",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "72px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(600px, calc(100vw - 2rem))",
              backgroundColor: "#0a1628",
              border: "1px solid #1e3a5f",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 24px 64px #000",
            }}
          >
            {/* Input row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", borderBottom: "1px solid #1e3a5f" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") close();
                  if (e.key === "Enter" && results[0]) go(results[0]);
                }}
                placeholder="Search states or districts…"
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#e2e8f0", fontSize: "1rem", fontFamily: "inherit",
                }}
              />
              <button onClick={close} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", padding: "0.25rem" }}>✕</button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => go(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      width: "100%", padding: "0.75rem 1rem",
                      background: "none", border: "none", borderBottom: "1px solid #0f2040",
                      color: "#e2e8f0", textAlign: "left", cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#0f2040")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: "1.1rem", width: "24px", textAlign: "center", flexShrink: 0 }}>
                      {r.type === "state" ? "🏛️" : "🗺️"}
                    </span>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{r.name}</div>
                      {r.extra && <div style={{ fontSize: "0.72rem", color: "#475569" }}>{r.extra}</div>}
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.type}</span>
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && (
              <div style={{ padding: "1.5rem 1rem", color: "#475569", fontSize: "0.85rem", textAlign: "center" }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {query.length < 2 && (
              <div style={{ padding: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {["Delhi", "Maharashtra", "Kerala", "Uttar Pradesh", "West Bengal"].map(s => (
                  <button key={s} onClick={() => setQuery(s)}
                    style={{ fontSize: "0.8rem", backgroundColor: "#0f2040", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "6px", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .header-join-btn { display: none !important; }
          .header-username { display: none; }
        }
        @media (max-width: 480px) {
          .header-search-label { display: none; }
        }
      `}</style>
    </header>
  );
}
