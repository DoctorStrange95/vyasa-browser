import AuthForm from "@/components/AuthForm";
import VyasaLogo from "@/components/VyasaLogo";
import Link from "next/link";

export const metadata = { title: "Sign Up — Vyasa" };

export default function AuthPage({ searchParams }: { searchParams: { next?: string; mode?: string } }) {
  const next       = searchParams.next ?? "/profile";
  const isCitizen  = next.startsWith("/citizens");
  const initialMode = searchParams.mode === "login" ? "login" : "register";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070f1e", display: "flex", flexDirection: "column" }}>
      <div style={{ backgroundColor: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 2rem", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <VyasaLogo size={28} />
          <span className="font-display" style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Vyasa</span>
        </Link>
        <Link href={next} style={{ fontSize: "0.75rem", color: "#475569", textDecoration: "none" }}>← Back</Link>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
              {isCitizen ? "🏥" : "🩺"}
            </div>
            <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem" }}>
              {isCitizen ? "Citizens Health Centre" : "Join Vyasa"}
            </h1>
            <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
              {isCitizen
                ? "Sign in or create an account to access your health locker and hospital registration features."
                : "Sign in or create an account to contribute health data for your district."}
            </p>
          </div>
          <AuthForm redirectTo={next} initialMode={initialMode} />
        </div>
      </div>
    </div>
  );
}
