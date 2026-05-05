import { notFound } from "next/navigation";
import { adminGet, adminQuery, getAdminDb } from "@/lib/firestore-admin";
import Link from "next/link";
import VyasaLogo from "@/components/VyasaLogo";

export const dynamic = "force-dynamic";

interface File { _id: string; name: string; mimeType: string; size: number; uploadedAt: string; data: string; }

function fmtBytes(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const tokenDoc = await adminGet("health_share_tokens", params.token).catch(() => null);
  if (!tokenDoc) notFound();

  if (new Date(tokenDoc.expiresAt as string) < new Date()) {
    return (
      <div style={{ minHeight: "100vh", background: "#070f1e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem", color: "#94a3b8", padding: "2rem" }}>
        <div style={{ fontSize: "3rem" }}>⏰</div>
        <h1 style={{ color: "#e2e8f0", margin: 0 }}>Link Expired</h1>
        <p style={{ margin: 0, textAlign: "center" }}>This health record link has expired. Ask the patient to share a new link from their Health Locker.</p>
        <Link href="/" style={{ color: "#38bdf8", fontSize: "0.88rem" }}>← Vyasa</Link>
      </div>
    );
  }

  const db    = getAdminDb();
  const snap  = await db.collection("health_locker_files").where("uid", "==", tokenDoc.uid).limit(50).get();
  const files = snap.docs.map((d) => ({ _id: d.id, ...d.data() })) as File[];
  files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const ownerName  = tokenDoc.name as string;
  const expiresAt  = new Date(tokenDoc.expiresAt as string);

  return (
    <div style={{ minHeight: "100vh", background: "#070f1e", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ background: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
            <VyasaLogo size={26} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>Vyasa</span>
          </Link>
          <span style={{ fontSize: "0.72rem", color: "#475569" }}>
            Shared · expires {expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Patient info */}
        <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1.1rem", color: "#4ade80", flexShrink: 0 }}>
            {ownerName[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{ownerName}</div>
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>
              {files.length} health document{files.length !== 1 ? "s" : ""} · Shared via Vyasa Health Locker
            </div>
          </div>
        </div>

        {/* Files */}
        {files.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", padding: "2rem" }}>No documents in this health locker.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {files.map((f) => (
              <div key={f._id} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "12px", overflow: "hidden" }}>
                {/* File header */}
                <div style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                    <span style={{ fontSize: "1.1rem" }}>{f.mimeType === "application/pdf" ? "📄" : "🖼️"}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{fmtBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString("en-IN")}</div>
                    </div>
                  </div>
                  <a
                    href={`data:${f.mimeType};base64,${f.data}`}
                    download={f.name}
                    style={{ background: "#0f3460", color: "#93c5fd", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", fontSize: "0.78rem", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    ⬇ Download
                  </a>
                </div>

                {/* Inline preview for images */}
                {f.mimeType.startsWith("image/") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${f.mimeType};base64,${f.data}`}
                    alt={f.name}
                    style={{ width: "100%", maxHeight: "600px", objectFit: "contain", background: "#050d1a", display: "block" }}
                  />
                )}

                {/* PDF inline view */}
                {f.mimeType === "application/pdf" && (
                  <div style={{ padding: "1rem", color: "#64748b", fontSize: "0.82rem", textAlign: "center" }}>
                    PDF document — use the Download button above to open.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "2rem", padding: "0.75rem 1rem", background: "#050d1a", borderRadius: "8px", fontSize: "0.72rem", color: "#334155", textAlign: "center" }}>
          🔒 This link was shared by {ownerName} and expires {expiresAt.toLocaleString("en-IN")}. Powered by Vyasa.
        </div>
      </div>
    </div>
  );
}
