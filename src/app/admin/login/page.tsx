"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import VyasaLogo from "@/components/VyasaLogo";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Login failed");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a1628", padding: "2rem" }}>
      <div style={{ backgroundColor: "#0f2040", border: "1px solid #1e3a5f", borderRadius: "16px", padding: "2.5rem", width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <VyasaLogo size={52} />
          </div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" }}>
            Admin Panel
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Vyasa</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              style={{ width: "100%", backgroundColor: "#070f1e", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.75rem 1rem", color: "#e2e8f0", fontSize: "0.95rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: "#ef444415", border: "1px solid #ef444440", borderRadius: "8px", padding: "0.75rem 1rem", color: "#ef4444", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{ backgroundColor: loading ? "#0a7368" : "#0d9488", color: "#fff", border: "none", borderRadius: "8px", padding: "0.85rem", fontSize: "0.95rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "#334155" }}>
          Session valid for 8 hours · HTTPS only in production
        </p>
      </div>
    </div>
  );
}
