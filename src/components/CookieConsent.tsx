"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage may be blocked in some browsers
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch { /* noop */ }
    setVisible(false);
    // Fire a tracking hit for the current page right on consent
    // (PageTracker won't fire for this session since sessionStorage key isn't set yet)
    const path = window.location.pathname;
    if (!path.startsWith("/admin")) {
      try { sessionStorage.setItem(`tracked_${path}`, "1"); } catch { /* blocked */ }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      }).catch(() => {});
    }
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, "declined"); } catch { /* noop */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: "1.25rem", left: "50%", transform: "translateX(-50%)",
      zIndex: 9998, width: "min(680px, calc(100vw - 2rem))",
      backgroundColor: "#0a1628", border: "1px solid #1e3a5f",
      borderRadius: "14px", padding: "1.1rem 1.4rem",
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem",
      boxShadow: "0 8px 32px #00000080",
    }}>
      <div style={{ flex: 1, minWidth: "200px" }}>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.6 }}>
          We use cookies to keep you signed in and to understand how people use Vyasa (analytics only — no ads).{" "}
          <Link href="/cookies" style={{ color: "#60a5fa", textDecoration: "underline" }}>Cookie Policy</Link>
          {" · "}
          <Link href="/privacy" style={{ color: "#60a5fa", textDecoration: "underline" }}>Privacy Policy</Link>
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexShrink: 0 }}>
        <button onClick={decline}
          style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#64748b", borderRadius: "7px", padding: "0.4rem 0.9rem", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
          Decline analytics
        </button>
        <button onClick={accept}
          style={{ background: "#0d9488", border: "none", color: "#fff", borderRadius: "7px", padding: "0.4rem 1rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Accept all
        </button>
      </div>
    </div>
  );
}
