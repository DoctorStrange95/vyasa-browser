import { NextRequest, NextResponse } from "next/server";
import { adminQuery, adminUpdate } from "@/lib/firestore-admin";
import { signUserToken, USER_COOKIE } from "@/lib/userAuth";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

async function verifyPassword(pw: string, stored: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith("scrypt:")) {
    const [, salt, hash] = stored.split(":");
    if (!salt || !hash) return { ok: false, needsUpgrade: false };
    const buf = await scrypt(pw, salt, 64) as Buffer;
    const ok  = crypto.timingSafeEqual(buf, Buffer.from(hash, "hex"));
    return { ok, needsUpgrade: false };
  }
  // Legacy SHA-256 — verify and flag for upgrade
  const legacyHash = crypto
    .createHash("sha256")
    .update(pw + (process.env.USER_JWT_SECRET ?? ""))
    .digest("hex");
  const ok = crypto.timingSafeEqual(
    Buffer.from(legacyHash, "hex"),
    Buffer.from(stored, "hex")
  );
  return { ok, needsUpgrade: ok };
}

async function upgradeHash(uid: string, pw: string) {
  const salt = crypto.randomBytes(32).toString("hex");
  const buf  = await scrypt(pw, salt, 64) as Buffer;
  const hash = `scrypt:${salt}:${buf.toString("hex")}`;
  await adminUpdate("users", uid, { passwordHash: hash }).catch(() => {});
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { identifier, email: emailField, password } = body as { identifier?: string; email?: string; password: string };
  const raw = (identifier ?? emailField ?? "").trim();
  if (!raw || !password) {
    return NextResponse.json({ error: "Email (or phone) and password are required." }, { status: 400 });
  }

  const isPhone = !raw.includes("@");
  let rows: Record<string, unknown>[];
  let resolvedEmail: string;

  try {
    if (isPhone) {
      const phone = normalizePhone(raw);
      if (phone.length !== 10) {
        return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
      }
      rows = await adminQuery("users", "phone", phone, 1);
      if (!rows.length) {
        return NextResponse.json({ error: "No account found with this phone number." }, { status: 404 });
      }
      resolvedEmail = String(rows[0].email ?? "");
    } else {
      resolvedEmail = raw.toLowerCase();
      rows = await adminQuery("users", "email", resolvedEmail, 1);
      if (!rows.length) {
        return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
      }
    }

    const user = rows[0];
    const { ok, needsUpgrade } = await verifyPassword(password, String(user.passwordHash ?? ""));
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    if (needsUpgrade) upgradeHash(String(user._id), password);

    const token = await signUserToken({ uid: String(user._id), name: String(user.name), email: resolvedEmail });
    const res   = NextResponse.json({ success: true, name: user.name, email: resolvedEmail });
    res.cookies.set(USER_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    return res;
  } catch (e: unknown) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
