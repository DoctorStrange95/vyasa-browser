"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const API = "https://vyasa-os-backend.onrender.com";
const PORTAL = "https://vyasa-health-os.pages.dev";

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  qualification: string;
  profileSlug: string;
  profilePhotoUrl: string;
  yearsExperience: number;
  consultationFee: number | null;
  acceptingPatients: boolean;
  city: string;
  state: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  timings: string;
  bio: string;
}

interface DirectoryData {
  doctors: Doctor[];
  total: number;
  filters: { states: string[]; cities: string[]; specialties: string[] };
}

function Initials({ name }: { name: string }) {
  const i = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#0d9488", "#1B4F8A", "#7C3AED", "#D97706", "#DC2626"];
  const c = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: 52, height: 52, borderRadius: 14, background: c + "22", border: `1.5px solid ${c}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: c, flexShrink: 0 }}>
      {i}
    </div>
  );
}

export default function DoctorDirectory() {
  const [data, setData] = useState<DirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "24" });
      if (state) params.set("state", state);
      if (city) params.set("city", city);
      if (specialty) params.set("specialty", specialty);
      if (search) params.set("search", search);
      const res = await fetch(`${API}/public/doctors?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* offline or server cold */ }
    finally { setLoading(false); }
  }, [state, city, specialty, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(v), 350);
  }

  const states = data?.filters.states ?? [];
  const cities = data?.filters.cities ?? [];
  const specialties = data?.filters.specialties ?? [];

  return (
    <div style={{ width: "100%" }}>
      {/* Search + Filters */}
      <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Search input */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: "1rem", pointerEvents: "none" }}>🔍</span>
          <input
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name, specialty, city…"
            style={{ width: "100%", background: "#080f1e", border: "1px solid #1e3a5f", color: "#e2e8f0", borderRadius: 10, padding: "0.7rem 1rem 0.7rem 2.5rem", fontSize: "0.9rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {/* Filter chips row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {/* State */}
          <select value={state} onChange={e => { setState(e.target.value); setCity(""); }}
            style={{ background: "#0f2040", border: `1px solid ${state ? "#0d9488" : "#1e3a5f"}`, color: state ? "#2dd4bf" : "#94a3b8", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">All States</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* City */}
          <select value={city} onChange={e => setCity(e.target.value)}
            style={{ background: "#0f2040", border: `1px solid ${city ? "#0d9488" : "#1e3a5f"}`, color: city ? "#2dd4bf" : "#94a3b8", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Specialty */}
          <select value={specialty} onChange={e => setSpecialty(e.target.value)}
            style={{ background: "#0f2040", border: `1px solid ${specialty ? "#0d9488" : "#1e3a5f"}`, color: specialty ? "#2dd4bf" : "#94a3b8", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {(state || city || specialty || search) && (
            <button onClick={() => { setState(""); setCity(""); setSpecialty(""); setSearch(""); setSearchInput(""); }}
              style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}>
              Clear filters
            </button>
          )}

          {data && (
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#475569" }}>
              {data.total} doctor{data.total !== 1 ? "s" : ""} on platform
            </span>
          )}
        </div>
      </div>

      {/* Doctor grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "#080f1e", border: "1px solid #1e3a5f", borderRadius: 12, padding: "1rem", animation: "pulse 1.5s infinite" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#1e3a5f" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, background: "#1e3a5f", borderRadius: 6, marginBottom: 8, width: "70%" }} />
                  <div style={{ height: 11, background: "#1e3a5f", borderRadius: 6, width: "50%" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !data?.doctors.length ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#475569" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🩺</div>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b", margin: "0 0 0.5rem" }}>No doctors found</p>
          <p style={{ fontSize: "0.85rem" }}>Try clearing the filters or broadening your search.</p>
          <a href={`${PORTAL}/register`} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: "1rem", background: "#0d9488", color: "white", borderRadius: 8, padding: "0.6rem 1.2rem", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
            Are you a doctor? Join the platform →
          </a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {data.doctors.map(doc => (
            <a
              key={doc.id}
              href={`${PORTAL}/dr/${doc.profileSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", background: "#080f1e", border: "1px solid #1e3a5f", borderRadius: 12, padding: "1rem 1.1rem", textDecoration: "none", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0d9488"; (e.currentTarget as HTMLElement).style.background = "#0a1628"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e3a5f"; (e.currentTarget as HTMLElement).style.background = "#080f1e"; }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                {doc.profilePhotoUrl ? (
                  <img src={doc.profilePhotoUrl} alt={doc.name} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", flexShrink: 0, border: "1.5px solid #1e3a5f" }} />
                ) : <Initials name={doc.name} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#e2e8f0" }}>Dr. {doc.name}</span>
                    {doc.acceptingPatients && (
                      <span style={{ fontSize: "0.62rem", background: "#0d948820", color: "#2dd4bf", border: "1px solid #0d948840", borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>Booking open</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#0d9488", fontWeight: 600, marginTop: 2 }}>
                    {doc.specialty || "Medical Professional"}
                    {doc.qualification && <span style={{ color: "#475569", fontWeight: 400 }}> · {doc.qualification}</span>}
                  </div>
                </div>
              </div>

              {doc.clinicName && (
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 4, display: "flex", gap: 5, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>🏥</span> {doc.clinicName}
                </div>
              )}
              {(doc.city || doc.state) && (
                <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: 4, display: "flex", gap: 5 }}>
                  <span>📍</span> {[doc.city, doc.state].filter(Boolean).join(", ")}
                </div>
              )}
              {doc.timings && (
                <div style={{ fontSize: "0.72rem", color: "#334155", marginBottom: 6, display: "flex", gap: 5 }}>
                  <span>⏰</span> {doc.timings}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e3a5f" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {doc.yearsExperience > 0 && (
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>⏳ {doc.yearsExperience}+ yrs</span>
                  )}
                  {doc.consultationFee && (
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>💰 ₹{doc.consultationFee}</span>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: "#0d9488", fontWeight: 700 }}>
                  {doc.acceptingPatients ? "Book Appointment →" : "View Profile →"}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
