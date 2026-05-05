"use client";
import { useRouter } from "next/navigation";

export default function AdminLogout() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button onClick={logout} style={{ backgroundColor: "transparent", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "0.35rem 0.9rem", color: "#64748b", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}>
      Sign out
    </button>
  );
}
