"use client";
export default function OfflinePage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#070f1e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>📡</div>
      <h1 style={{ color: "#e2e8f0", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        You&rsquo;re offline
      </h1>
      <p style={{ color: "#64748b", fontSize: "0.9rem", maxWidth: "380px", lineHeight: 1.7, marginBottom: "2rem" }}>
        Vyasa needs a connection to load live health data. Check your network and try again — recently visited pages will load from cache.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#0d9488",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "0.6rem 1.5rem",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
