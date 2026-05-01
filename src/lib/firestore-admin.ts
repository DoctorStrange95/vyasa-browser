/**
 * Firebase Admin SDK helper — bypasses Firestore security rules.
 * Used only in server-side admin API routes (protected by JWT middleware).
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string or base64-encoded JSON).
 */

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: Firestore | null = null;

function buildCredentialFromEnv(): Record<string, unknown> {
  // Option 1: individual env vars (preferred — set when rotating the key)
  const clientEmail = process.env.CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const privateKey  = process.env.PRIVATE_KEY  ?? process.env.FIREBASE_PRIVATE_KEY  ?? "";
  if (clientEmail && privateKey) {
    return {
      type:                        process.env.TYPE ?? "service_account",
      project_id:                  process.env.PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "",
      private_key_id:              process.env.PRIVATE_KEY_ID ?? "",
      private_key:                 privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey,
      client_email:                clientEmail,
      client_id:                   process.env.CLIENT_ID ?? "",
      auth_uri:                    process.env.AUTH_URI ?? "https://accounts.google.com/o/oauth2/auth",
      token_uri:                   process.env.TOKEN_URI ?? "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL ?? "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url:        process.env.CLIENT_X509_CERT_URL ?? "",
      universe_domain:             process.env.UNIVERSE_DOMAIN ?? "googleapis.com",
    };
  }

  // Option 2: legacy single JSON blob
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "";
  if (!raw) throw new Error("Firebase credentials not configured. Set CLIENT_EMAIL + PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_KEY.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON or base64-encoded JSON.");
    }
  }
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function getAdminDb(): Firestore {
  if (_db) return _db;

  const parsed = buildCredentialFromEnv();

  const existingApps = getApps();
  if (existingApps.length === 0) {
    _app = initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
  } else {
    _app = existingApps[0];
  }

  _db = getFirestore(_app);
  return _db;
}

export function getAdminApp(): App {
  getAdminDb(); // ensures initialization
  if (!_app) throw new Error("Firebase Admin app not initialized");
  return _app;
}

export async function adminGet(
  col: string,
  id: string,
): Promise<(Record<string, unknown> & { _id: string }) | null> {
  const db  = getAdminDb();
  const doc = await db.collection(col).doc(id).get();
  if (!doc.exists) return null;
  return { ...(doc.data() as Record<string, unknown>), _id: doc.id };
}

export async function adminList(
  col: string,
  maxItems = 200,
): Promise<Array<Record<string, unknown> & { _id: string }>> {
  const db   = getAdminDb();
  const snap = await db.collection(col).limit(maxItems).get();
  return snap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), _id: d.id }));
}

export async function adminQuery(
  col: string,
  field: string,
  value: unknown,
  maxItems = 200,
): Promise<Array<Record<string, unknown> & { _id: string }>> {
  const db   = getAdminDb();
  const snap = await db.collection(col).where(field, "==", value).limit(maxItems).get();
  return snap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), _id: d.id }));
}

export async function adminSet(
  col: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getAdminDb();
  await db.collection(col).doc(id).set(data);
}

export async function adminUpdate(
  col: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getAdminDb();
  await db.collection(col).doc(id).update(data);
}

export async function adminBatchUpdate(
  col: string,
  ids: string[],
  data: Record<string, unknown>,
): Promise<void> {
  if (!ids.length) return;
  const db    = getAdminDb();
  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection(col).doc(id), data);
  }
  await batch.commit();
}

export async function adminAdd(
  col: string,
  data: Record<string, unknown>,
): Promise<string> {
  const db  = getAdminDb();
  const ref = await db.collection(col).add(data);
  return ref.id;
}

export async function adminDelete(col: string, id: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(col).doc(id).delete();
}

export async function adminSetSubcollection(
  col: string,
  id: string,
  subCol: string,
  subId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getAdminDb();
  await db.collection(col).doc(id).collection(subCol).doc(subId).set(data);
}

export async function adminListSubcollection(
  col: string,
  id: string,
  subCol: string,
  maxItems = 1000,
): Promise<Array<Record<string, unknown> & { _id: string }>> {
  const db   = getAdminDb();
  const snap = await db.collection(col).doc(id).collection(subCol).limit(maxItems).get();
  return snap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), _id: d.id }));
}

export { getAdminDb };
