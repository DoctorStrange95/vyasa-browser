"use client";

import { useEffect, useState, useRef } from "react";
import type { CitizenUser } from "./CitizenAuthBar";

interface FileItem {
  _id: string; name: string; mimeType: string;
  size: number; uploadedAt: string;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") return <>📄</>;
  if (mimeType.startsWith("image/")) return <>🖼️</>;
  return <>📎</>;
}

interface Props {
  user: CitizenUser | null;
}

export default function HealthLocker({ user }: Props) {
  const [files, setFiles]           = useState<FileItem[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [preview, setPreview]       = useState<{ url: string; mimeType: string; name: string } | null>(null);
  const [sharing, setSharing]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const r = await fetch("/api/citizens/locker");
      const d = await r.json();
      setFiles(d.files ?? []);
    } catch { } finally { setLoadingFiles(false); }
  };

  useEffect(() => {
    if (user) loadFiles();
    else setFiles([]);
  }, [user]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 700 * 1024) {
      showToast("File too large (max 500 KB). Compress and retry.", "err");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/citizens/locker/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { showToast(d.error ?? "Upload failed.", "err"); return; }
      showToast(`${file.name} uploaded.`);
      await loadFiles();
    } catch { showToast("Upload failed.", "err"); }
    finally { setUploading(false); }
  };

  // ── Fetch file data (shared by download + preview) ─────────────────────────
  const fetchFile = async (id: string) => {
    const r = await fetch("/api/citizens/locker", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Failed");
    return d as { data: string; mimeType: string; name: string };
  };

  const toBlob = (data: string, mimeType: string): string => {
    const bytes = atob(data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mimeType }));
  };

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = async (f: FileItem) => {
    setDownloadId(f._id);
    try {
      const d   = await fetchFile(f._id);
      const url = toBlob(d.data, d.mimeType);
      const a   = document.createElement("a");
      a.href = url; a.download = d.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { showToast("Download failed.", "err"); }
    finally { setDownloadId(null); }
  };

  // ── Preview ─────────────────────────────────────────────────────────────────
  const handlePreview = async (f: FileItem) => {
    setDownloadId(f._id); // reuse loading indicator
    try {
      const d   = await fetchFile(f._id);
      const url = toBlob(d.data, d.mimeType);
      setPreview({ url, mimeType: d.mimeType, name: d.name });
    } catch { showToast("Preview failed.", "err"); }
    finally { setDownloadId(null); }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const r = await fetch("/api/citizens/locker", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) { const d = await r.json(); showToast(d.error ?? "Delete failed.", "err"); return; }
      showToast(`${name} deleted.`);
      setFiles((prev) => prev.filter((f) => f._id !== id));
    } catch { showToast("Delete failed.", "err"); }
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!files.length) return;
    setExporting(true);
    try {
      const r = await fetch("/api/citizens/locker/pdf", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        showToast((d as Record<string, string>).error ?? "PDF generation failed.", "err");
        return;
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `health-records-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Health record PDF downloaded.");
    } catch { showToast("PDF generation failed.", "err"); }
    finally { setExporting(false); }
  };

  // ── Share via WhatsApp ──────────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    if (!files.length) return;
    setSharing(true);
    try {
      const r = await fetch("/api/citizens/locker/share", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { showToast(d.error ?? "Could not create share link.", "err"); return; }
      const shareUrl = `${window.location.origin}/health-share/${d.token}`;
      const message  = encodeURIComponent(
        `Hello Doctor,\nPlease find my health records here:\n${shareUrl}\n(Link valid for 24 hours)\n\nShared via Vyasa`
      );
      window.open(`https://wa.me/?text=${message}`, "_blank");
    } catch { showToast("Could not create share link.", "err"); }
    finally { setSharing(false); }
  };

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div
        onClick={() => window.dispatchEvent(new CustomEvent("hfi:auth-prompt", { detail: { context: "locker" } }))}
        style={{ padding: "3rem 1rem", textAlign: "center", border: "1px dashed #1e3a5f", borderRadius: "12px", color: "#475569", cursor: "pointer" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔐</div>
        <div style={{ fontWeight: 600, color: "#64748b", marginBottom: "0.4rem" }}>Sign in to access your Health Locker</div>
        <div style={{ fontSize: "0.82rem" }}>Upload prescriptions, lab reports, vaccination certificates and share them with your doctor via WhatsApp.</div>
      </div>
    );
  }

  // ── Logged in ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Preview modal */}
      {preview && (
        <div
          onClick={closePreview}
          style={{ position: "fixed", inset: 0, backgroundColor: "#000000cc", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "10px", width: "100%", maxWidth: "860px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
              <span style={{ fontSize: "0.85rem", color: "#e2e8f0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.name}</span>
              <button onClick={closePreview} style={{ background: "none", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: "6px", padding: "0.2rem 0.6rem", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0, marginLeft: "0.5rem" }}>✕ Close</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#060e1c", minHeight: "300px" }}>
              {preview.mimeType.startsWith("image/") ? (
                <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain" }} />
              ) : (
                <iframe src={preview.url} title={preview.name} style={{ width: "100%", height: "75vh", border: "none" }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          background: toast.type === "ok" ? "#166534" : "#7f1d1d",
          color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "8px",
          fontSize: "0.85rem", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Upload zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: "2px dashed #1e3a5f", borderRadius: "10px", padding: "1.25rem",
          textAlign: "center", cursor: uploading ? "wait" : "pointer", marginBottom: "1rem",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e3a5f")}
      >
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handleUpload} />
        <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>⬆️</div>
        <div style={{ color: "#93c5fd", fontWeight: 500, fontSize: "0.88rem" }}>
          {uploading ? "Uploading…" : "Upload a document"}
        </div>
        <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: "0.2rem" }}>
          PDF, JPEG, PNG, WebP · Max 500 KB
        </div>
      </div>

      {/* Action bar — Export & Share */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button onClick={handleExportPdf} disabled={exporting} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#0f172a", color: "#93c5fd", border: "1px solid #1e3a5f",
            borderRadius: "8px", padding: "0.5rem 1rem", fontSize: "0.85rem",
            fontWeight: 500, cursor: exporting ? "wait" : "pointer",
            opacity: exporting ? 0.7 : 1,
          }}>
            📥 {exporting ? "Generating PDF…" : "Download as PDF"}
          </button>

          <button onClick={handleWhatsApp} disabled={sharing} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#0d2d18", color: "#4ade80", border: "1px solid #15803d",
            borderRadius: "8px", padding: "0.5rem 1rem", fontSize: "0.85rem",
            fontWeight: 500, cursor: sharing ? "wait" : "pointer",
            opacity: sharing ? 0.7 : 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.126 1.528 5.863L.057 23.893a.75.75 0 00.918.943l6.14-1.61A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.924 0-3.74-.504-5.312-1.386l-.38-.218-3.941 1.034 1.055-3.845-.237-.384A9.967 9.967 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            {sharing ? "Creating link…" : "Share via WhatsApp"}
          </button>
        </div>
      )}

      {/* File list */}
      {loadingFiles ? (
        <div style={{ color: "#64748b", textAlign: "center", fontSize: "0.88rem", padding: "1rem" }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ color: "#475569", textAlign: "center", fontSize: "0.85rem", padding: "1.5rem", border: "1px dashed #1e3a5f", borderRadius: "10px" }}>
          No documents yet. Upload prescriptions, reports or your health card above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[...files]
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
            .map((f) => (
              <div key={f._id} style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "10px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.2rem", flexShrink: 0 }}><FileIcon mimeType={f.mimeType} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "#e2e8f0", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    {fmtBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <button onClick={() => handlePreview(f)} disabled={downloadId === f._id} style={{
                  background: "#0f2040", color: "#7dd3fc", border: "1px solid #1e3a5f", borderRadius: "6px",
                  padding: "0.35rem 0.65rem", fontSize: "0.8rem", cursor: "pointer", flexShrink: 0,
                }}>
                  {downloadId === f._id ? "…" : "👁"}
                </button>
                <button onClick={() => handleDownload(f)} disabled={downloadId === f._id} style={{
                  background: "#0f3460", color: "#93c5fd", border: "none", borderRadius: "6px",
                  padding: "0.35rem 0.65rem", fontSize: "0.8rem", cursor: "pointer", flexShrink: 0,
                }}>
                  {downloadId === f._id ? "…" : "⬇"}
                </button>
                <button onClick={() => handleDelete(f._id, f.name)} style={{
                  background: "transparent", color: "#64748b", border: "none",
                  borderRadius: "6px", padding: "0.35rem 0.5rem", fontSize: "0.9rem", cursor: "pointer", flexShrink: 0,
                }}>✕</button>
              </div>
            ))}
        </div>
      )}

      <div style={{ marginTop: "1rem", padding: "0.65rem 1rem", background: "#050d1a", borderRadius: "8px", fontSize: "0.73rem", color: "#334155" }}>
        🔒 Documents are private and accessible only with your account. Max 500 KB per file.
        WhatsApp share links expire in 24 hours.
      </div>
    </div>
  );
}
