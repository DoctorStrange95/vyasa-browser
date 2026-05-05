"use client";

import { useEffect, useState } from "react";
import HospitalFinder from "./HospitalFinder";
import HealthLocker from "./HealthLocker";
import CitizenAuthBar, { CitizenUser } from "./CitizenAuthBar";

const TABS = [
  { id: "hospitals", label: "🏥 Find Hospital" },
  { id: "ayushman",  label: "🛡️ Ayushman Card" },
  { id: "locker",    label: "🔐 Health Locker" },
];

// ── Ayushman Card tab ────────────────────────────────────────────────────────
function AyushmanCardInfo() {
  return (
    <div>
      <div style={{ background: "#071428", border: "1px solid #fbbf2440", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "2rem" }}>🛡️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#fbbf24" }}>Ayushman Bharat PM-JAY Card</h2>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.2rem" }}>Pradhan Mantri Jan Arogya Yojana — ₹5 lakh annual health cover</div>
          </div>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
          Ayushman Bharat PM-JAY is India&apos;s flagship public health insurance scheme providing free secondary and tertiary healthcare coverage of up to <strong style={{ color: "#fbbf24" }}>₹5 lakh per family per year</strong> at any empanelled government or private hospital. It covers over <strong style={{ color: "#e2e8f0" }}>1,929 procedures</strong> including surgeries, medical treatments, and day-care procedures.
        </p>
      </div>

      <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.95rem", marginBottom: "0.85rem" }}>✅ Who Is Eligible?</div>
        <ul style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 2, paddingLeft: "1.25rem", margin: 0 }}>
          <li>Families listed in <strong style={{ color: "#e2e8f0" }}>SECC 2011 database</strong> (Socio-Economic Caste Census)</li>
          <li>Active <strong style={{ color: "#e2e8f0" }}>RSBY beneficiaries</strong></li>
          <li>Beneficiaries identified by <strong style={{ color: "#e2e8f0" }}>state government schemes</strong> (varies by state)</li>
          <li>No cap on family size or age</li>
          <li>Coverage is <strong style={{ color: "#e2e8f0" }}>portable</strong> across India — use at any empanelled hospital nationwide</li>
        </ul>
      </div>

      <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.95rem", marginBottom: "0.85rem" }}>📋 Steps to Get Your Card</div>
        <ol style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 2.1, paddingLeft: "1.25rem", margin: 0 }}>
          <li><strong style={{ color: "#e2e8f0" }}>Check eligibility</strong> on the official portal using your mobile number, Aadhaar, or ration card</li>
          <li><strong style={{ color: "#e2e8f0" }}>Visit your nearest Common Service Centre (CSC)</strong>, empanelled hospital, or Ayushman Mitra</li>
          <li>Carry <strong style={{ color: "#e2e8f0" }}>Aadhaar card</strong> and one family ID (ration card / voter ID)</li>
          <li>Get <strong style={{ color: "#e2e8f0" }}>e-KYC done</strong> (biometric or OTP-based) at the centre</li>
          <li><strong style={{ color: "#e2e8f0" }}>Download or print</strong> your Ayushman Bharat card (PM-JAY Health Card)</li>
          <li>Show the card at any <strong style={{ color: "#e2e8f0" }}>AB-PMJAY empanelled hospital</strong> to avail cashless treatment</li>
        </ol>
      </div>

      <div style={{ background: "#071428", border: "1px solid #1e3a5f", borderRadius: "14px", padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: "0.95rem", marginBottom: "0.85rem" }}>🔗 Official Links</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <a href="https://beneficiary.nha.gov.in" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.75rem 1rem", textDecoration: "none", color: "#93c5fd" }}>
            <span style={{ fontSize: "1.1rem" }}>🔍</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>beneficiary.nha.gov.in</div>
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.1rem" }}>Check your eligibility by mobile / Aadhaar / ration card</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.8rem" }}>↗</span>
          </a>
          <a href="https://pmjay.gov.in" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.75rem 1rem", textDecoration: "none", color: "#93c5fd" }}>
            <span style={{ fontSize: "1.1rem" }}>🏛️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>pmjay.gov.in</div>
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.1rem" }}>Official PM-JAY portal — scheme details, news, empanelled hospitals</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.8rem" }}>↗</span>
          </a>
          <a href="https://hospitals.pmjay.gov.in" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "9px", padding: "0.75rem 1rem", textDecoration: "none", color: "#93c5fd" }}>
            <span style={{ fontSize: "1.1rem" }}>🏥</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>hospitals.pmjay.gov.in</div>
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.1rem" }}>Find empanelled hospitals near you — official NHA directory</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.8rem" }}>↗</span>
          </a>
        </div>
      </div>

      <div style={{ background: "#071428", border: "1px solid #22c55e30", borderRadius: "14px", padding: "1.25rem" }}>
        <div style={{ fontWeight: 700, color: "#4ade80", fontSize: "0.95rem", marginBottom: "0.65rem" }}>📞 Helpline</div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ background: "#0f2040", border: "1px solid #22c55e20", borderRadius: "9px", padding: "0.75rem 1.25rem" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>14555</div>
            <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.2rem" }}>PM-JAY Toll Free — 24×7</div>
          </div>
          <div style={{ background: "#0f2040", border: "1px solid #22c55e20", borderRadius: "9px", padding: "0.75rem 1.25rem" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>1800-111-565</div>
            <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.2rem" }}>NHA Helpline — Toll Free</div>
          </div>
        </div>
        <div style={{ marginTop: "0.85rem", background: "#0d1f3c", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1rem" }}>🔔</span>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
            <strong style={{ color: "#94a3b8" }}>Vyasa Helpline — Coming Soon.</strong> We&apos;re building a dedicated citizen helpline to guide you through the Ayushman card process in your local language.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CitizensPage() {
  const [user, setUser]                             = useState<CitizenUser | null | "loading">("loading");
  const [activeTab, setActiveTab]                   = useState("hospitals");
  const [prefilledHospState, setPrefilledHospState] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab);
      const prestate = params.get("prestate");
      if (prestate) setPrefilledHospState(decodeURIComponent(prestate));
    }
  }, []);

  useEffect(() => {
    fetch("/api/citizens/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d))
      .catch(() => setUser(null));
  }, []);

  const isLoggedIn = user !== null && user !== "loading";

  return (
    <div style={{ backgroundColor: "#070f1e", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ borderBottom: "1px solid #1e3a5f", padding: "2.5rem 1.5rem 2rem", background: "linear-gradient(180deg, #071830 0%, #070f1e 100%)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "2rem" }}>🏥</span>
            <h1 className="font-display" style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.15 }}>
              Citizens Health Centre
            </h1>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "1rem", margin: "0 0 0 2.85rem", lineHeight: 1.6 }}>
            Find Ayushman Bharat empanelled hospitals · Secure health locker
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1e3a5f", backgroundColor: "#060d1b" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem", display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "1rem 1.5rem", border: "none", background: "transparent",
              color: activeTab === tab.id ? "#93c5fd" : "#64748b",
              borderBottom: activeTab === tab.id ? "3px solid #3b82f6" : "3px solid transparent",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.95rem", cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: "inherit", minHeight: "54px", letterSpacing: activeTab === tab.id ? "-0.01em" : "0",
              transition: "color 0.15s",
            }}>
              {tab.label}
              {tab.id === "locker" && !isLoggedIn && (
                <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#475569" }}>🔒</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="citizens-body" style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
        <CitizenAuthBar user={user} onAuthChange={setUser} />

        {activeTab === "hospitals" && (
          <HospitalFinder
            isLoggedIn={isLoggedIn}
            prefilledState={prefilledHospState}
            onPrefilledUsed={() => setPrefilledHospState("")}
          />
        )}
        {activeTab === "ayushman" && <AyushmanCardInfo />}
        {activeTab === "locker"   && <HealthLocker user={isLoggedIn ? (user as CitizenUser) : null} />}
      </div>
    </div>
  );
}
