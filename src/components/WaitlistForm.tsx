"use client";
import { useState } from "react";

const ROLES = [
  { val: "Doctor / Physician",            icon: "👨‍⚕️" },
  { val: "Hospital Administrator",        icon: "🏥" },
  { val: "Nurse / Nursing Staff",         icon: "👩‍⚕️" },
  { val: "Lab Technician / Pathologist",  icon: "🧪" },
  { val: "Pharmacist",                    icon: "💊" },
  { val: "Government Health Official",    icon: "🏛️" },
  { val: "Public Health Researcher",      icon: "📊" },
  { val: "Medical College Faculty",       icon: "🎓" },
  { val: "Health IT Professional",        icon: "💻" },
  { val: "Other",                         icon: "🔹" },
];

const DOCTOR_SPECIALIZATIONS = [
  "General Medicine / Family Medicine",
  "Paediatrics", "Gynaecology & Obstetrics", "Cardiology", "Neurology",
  "Orthopaedics", "Surgery", "Dermatology", "ENT", "Psychiatry",
  "Radiology / Imaging", "Anaesthesiology", "Ophthalmology",
  "Oncology", "Emergency Medicine", "Other",
];

const FACILITY_SIZES = [
  { val: "solo",       label: "Solo Practice",      sub: "No beds / OPD only" },
  { val: "small",      label: "Small Clinic",        sub: "5–25 beds" },
  { val: "medium",     label: "Medium Hospital",     sub: "25–50 beds" },
  { val: "large",      label: "Large Hospital",      sub: "50–100 beds" },
  { val: "enterprise", label: "Enterprise / Chain",  sub: "100+ beds" },
  { val: "phc",        label: "PHC / CHC / Govt",   sub: "Government facility" },
];

const OPD_LOAD = [
  { val: "under20",  label: "< 20 / day" },
  { val: "20to50",   label: "20–50 / day" },
  { val: "50to150",  label: "50–150 / day" },
  { val: "over150",  label: "150+ / day" },
];

const CURRENT_SYSTEM = [
  { val: "paper",    label: "Paper only",         icon: "📄" },
  { val: "basic",    label: "Basic EMR / billing", icon: "💾" },
  { val: "fullhms",  label: "Full HMS installed",  icon: "🖥️" },
  { val: "none",     label: "Nothing yet",         icon: "❌" },
];

// Mapped from pitch deck pain points
const PAIN_POINTS = [
  { id: "paper_rx",    label: "Paper prescriptions — illegible, error-prone",         icon: "✍️" },
  { id: "comm",        label: "Communication delays between doctors, nurses, pharmacy", icon: "📞" },
  { id: "billing",     label: "Billing errors & revenue leakage",                      icon: "💸" },
  { id: "lab_delay",   label: "Lab result delays reaching the treating doctor",         icon: "🧪" },
  { id: "burnout",     label: "Non-medical clerical work causing burnout",              icon: "😓" },
  { id: "no_monitor",  label: "No real-time monitoring of patients remotely",           icon: "📡" },
  { id: "no_idsp",     label: "No access to IDSP / outbreak alerts in my workflow",     icon: "🚨" },
  { id: "discharge",   label: "Discharge summaries take too long to prepare",           icon: "📋" },
];

const INTERESTS = [
  { id: "prescriptions", label: "Digital Prescriptions & EMR",        icon: "📝" },
  { id: "sos",           label: "Live SOS Alerts for nurses/doctors",  icon: "🔴" },
  { id: "lab",           label: "Lab Integration — results in real-time", icon: "🧪" },
  { id: "pharmacy",      label: "Pharmacy Dispensing & MAR",            icon: "💊" },
  { id: "billing",       label: "Auto-Billing — zero revenue leakage",  icon: "🧾" },
  { id: "analytics",     label: "AI Discharge Summaries & Analytics",   icon: "📊" },
  { id: "surveillance",  label: "IDSP Outbreak & NCD Surveillance",     icon: "📡" },
  { id: "coordination",  label: "Cross-Institution Collaboration",      icon: "🤝" },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh",
  "Andaman & Nicobar Islands","Dadra & Nagar Haveli","Daman & Diu","Lakshadweep",
];

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [name,               setName]               = useState("");
  const [email,              setEmail]              = useState("");
  const [phone,              setPhone]              = useState("");
  const [role,               setRole]               = useState("");
  const [specialization,     setSpecialization]     = useState("");
  const [facilitySize,       setFacilitySize]       = useState("");
  const [opdLoad,            setOpdLoad]            = useState("");
  const [currentSystem,      setCurrentSystem]      = useState("");
  const [prescriptionBoring, setPrescriptionBoring] = useState("");
  const [painPoints,         setPainPoints]         = useState<string[]>([]);
  const [interests,          setInterests]          = useState<string[]>([]);
  const [city,               setCity]               = useState("");
  const [state,              setState]              = useState("");
  const [referral,           setReferral]           = useState("");
  const [status,             setStatus]             = useState<Status>("idle");
  const [errMsg,             setErrMsg]             = useState("");

  const isDoctor   = role.startsWith("Doctor");
  const isHospital = role === "Hospital Administrator";
  const isNurse    = role.startsWith("Nurse");

  function toggle(arr: string[], set: (v: string[]) => void, id: string) {
    set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !role) {
      setErrMsg("Please fill in name, email, phone and role."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrMsg("Please enter a valid email address."); return;
    }
    setStatus("submitting"); setErrMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone, role, specialization,
          facilitySize, opdLoad, currentSystem,
          prescriptionBoring, painPoints, interests,
          city, state, referral,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error ?? "Submission failed."); setStatus("error"); return; }
      setStatus("success");
    } catch {
      setErrMsg("Network error. Please try again."); setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div style={{ maxWidth: "560px", margin: "0 auto", textAlign: "center", padding: "3rem 1.5rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎉</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>You&apos;re on the list!</h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.8, marginBottom: "1.75rem" }}>
          We&apos;ll reach out soon with a personalized onboarding session. We&apos;re rolling out by specialization and region to keep quality high — thank you for joining the Vyasa network.
        </p>
        <div style={{ backgroundColor: "#0a1628", border: "1px solid #0d948840", borderRadius: "12px", padding: "1.25rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.7 }}>
          Meanwhile, track India&apos;s live disease surveillance data at{" "}
          <a href="/" style={{ color: "#2dd4bf", textDecoration: "none" }}>Vyasa →</a>
        </div>
      </div>
    );
  }

  const input: React.CSSProperties = {
    width: "100%", backgroundColor: "#080f1e", border: "1px solid #1e3a5f",
    borderRadius: "8px", color: "#e2e8f0", fontSize: "0.85rem",
    padding: "0.6rem 0.85rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const section: React.CSSProperties = {
    backgroundColor: "#080f1e", border: "1px solid #1e3a5f",
    borderRadius: "12px", padding: "1.5rem", display: "flex",
    flexDirection: "column", gap: "1.1rem",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem",
  };
  const sectionTitle = (color: string, text: string) => (
    <div style={{ fontSize: "0.68rem", color, textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 700 }}>{text}</div>
  );
  const req = <span style={{ color: "#f87171", marginLeft: "2px" }}>*</span>;

  function chipGrid(
    options: { val: string; label: string; sub?: string; icon?: string }[],
    selected: string,
    onSelect: (v: string) => void,
    color = "#0d9488",
    cols = "repeat(auto-fill, minmax(160px, 1fr))"
  ) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem" }}>
        {options.map(o => (
          <button key={o.val} type="button" onClick={() => onSelect(selected === o.val ? "" : o.val)} style={{
            padding: "0.55rem 0.85rem", fontSize: "0.78rem", textAlign: "left",
            backgroundColor: selected === o.val ? `${color}18` : "#060d1a",
            border: `1px solid ${selected === o.val ? color : "#1e3a5f"}`,
            borderRadius: "8px",
            color: selected === o.val ? color : "#64748b",
            cursor: "pointer", fontFamily: "inherit", fontWeight: selected === o.val ? 600 : 400,
            transition: "border-color 0.15s",
          }}>
            {o.icon && <span style={{ marginRight: "0.4rem" }}>{o.icon}</span>}
            <span style={{ display: "block", lineHeight: 1.3 }}>{o.label}</span>
            {o.sub && <span style={{ fontSize: "0.65rem", color: "#475569", fontWeight: 400 }}>{o.sub}</span>}
          </button>
        ))}
      </div>
    );
  }

  function multiChipGrid(
    options: { id: string; label: string; icon?: string }[],
    selected: string[],
    onToggle: (id: string) => void,
    color = "#22c55e",
  ) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "0.5rem" }}>
        {options.map(o => {
          const on = selected.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => onToggle(o.id)} style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.6rem 0.85rem", fontSize: "0.78rem", textAlign: "left",
              backgroundColor: on ? `${color}15` : "#060d1a",
              border: `1px solid ${on ? color : "#1e3a5f"}`,
              borderRadius: "8px", color: on ? color : "#64748b",
              cursor: "pointer", fontFamily: "inherit", fontWeight: on ? 600 : 400,
              transition: "border-color 0.15s",
            }}>
              {o.icon && <span style={{ flexShrink: 0 }}>{o.icon}</span>}
              <span style={{ lineHeight: 1.3 }}>{o.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── 1. Contact ── */}
      <div style={section}>
        {sectionTitle("#2dd4bf", "Your Contact Details")}
        <div>
          <label style={label}>Full Name {req}</label>
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Ananya Sharma" required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={label}>Email {req}</label>
            <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label style={label}>Phone {req}</label>
            <input style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={label}>City</label>
            <input style={input} value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          <div>
            <label style={label}>State</label>
            <select style={input} value={state} onChange={e => setState(e.target.value)}>
              <option value="">Select…</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 2. Role ── */}
      <div style={section}>
        {sectionTitle("#6366f1", "Your Role")}
        <div>
          <label style={label}>Role / Designation {req}</label>
          {chipGrid(
            ROLES.map(r => ({ val: r.val, label: r.val, icon: r.icon })),
            role,
            v => { setRole(v); if (!v.startsWith("Doctor")) setSpecialization(""); },
            "#6366f1",
            "repeat(auto-fill, minmax(190px, 1fr))"
          )}
        </div>

        {(isDoctor || isNurse || isHospital) && (
          <div>
            <label style={label}>{isDoctor ? "Specialization" : "Department / Area"}</label>
            {isDoctor ? (
              <select style={input} value={specialization} onChange={e => setSpecialization(e.target.value)}>
                <option value="">Select specialization…</option>
                {DOCTOR_SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input style={input} value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="e.g. ICU, Oncology, Emergency…" />
            )}
          </div>
        )}
      </div>

      {/* ── 3. Facility ── */}
      <div style={section}>
        {sectionTitle("#f59e0b", "Your Facility")}
        <div>
          <label style={label}>Facility Size</label>
          {chipGrid(FACILITY_SIZES, facilitySize, setFacilitySize, "#f59e0b", "repeat(auto-fill, minmax(180px, 1fr))")}
        </div>
        {(isDoctor || isHospital || isNurse) && (
          <div>
            <label style={label}>Average OPD / Patient Load per Day</label>
            {chipGrid(OPD_LOAD, opdLoad, setOpdLoad, "#f59e0b", "repeat(4, 1fr)")}
          </div>
        )}
        <div>
          <label style={label}>Current System in Use</label>
          {chipGrid(CURRENT_SYSTEM, currentSystem, setCurrentSystem, "#f59e0b", "repeat(auto-fill, minmax(160px, 1fr))")}
        </div>
      </div>

      {/* ── 4. Pain points ── */}
      <div style={section}>
        {sectionTitle("#f87171", "Your Biggest Frustrations")}
        <div>
          <label style={label}>What slows you down the most? (select all that apply)</label>
          {multiChipGrid(PAIN_POINTS, painPoints, id => toggle(painPoints, setPainPoints, id), "#f87171")}
        </div>
        <div>
          <label style={label}>Does writing prescriptions on paper feel boring or inefficient?</label>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {[
              { val: "yes",      label: "Yes — very much",       color: "#f87171" },
              { val: "somewhat", label: "Somewhat",              color: "#f59e0b" },
              { val: "no",       label: "Paper still works fine", color: "#4ade80" },
            ].map(o => (
              <button key={o.val} type="button" onClick={() => setPrescriptionBoring(o.val)} style={{
                padding: "0.5rem 1rem", fontSize: "0.8rem",
                backgroundColor: prescriptionBoring === o.val ? `${o.color}20` : "#060d1a",
                border: `1px solid ${prescriptionBoring === o.val ? o.color : "#1e3a5f"}`,
                borderRadius: "8px", color: prescriptionBoring === o.val ? o.color : "#64748b",
                cursor: "pointer", fontFamily: "inherit", fontWeight: prescriptionBoring === o.val ? 700 : 400,
                transition: "border-color 0.15s",
              }}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Interests ── */}
      <div style={section}>
        {sectionTitle("#22c55e", "What Interests You Most in Vyasa?")}
        <div>
          {multiChipGrid(INTERESTS, interests, id => toggle(interests, setInterests, id), "#22c55e")}
        </div>
        <div>
          <label style={label}>How did you hear about Vyasa? (optional)</label>
          <input style={input} value={referral} onChange={e => setReferral(e.target.value)} placeholder="Colleague, LinkedIn, conference, social media…" />
        </div>
      </div>

      {errMsg && (
        <div style={{ fontSize: "0.8rem", color: "#f87171", backgroundColor: "#ef444415", border: "1px solid #ef444430", borderRadius: "8px", padding: "0.7rem 1rem" }}>
          {errMsg}
        </div>
      )}

      <button type="submit" disabled={status === "submitting"} style={{
        backgroundColor: status === "submitting" ? "#0a3030" : "#0d9488",
        color: "#fff", border: "none", borderRadius: "10px",
        padding: "0.9rem 2rem", fontSize: "0.95rem", fontWeight: 700,
        cursor: status === "submitting" ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "background 0.15s",
      }}>
        {status === "submitting" ? "Joining…" : "Request Early Access →"}
      </button>

      <p style={{ fontSize: "0.7rem", color: "#334155", textAlign: "center", margin: 0 }}>
        No spam. We&apos;ll contact you only for onboarding and important updates.
      </p>
    </form>
  );
}
