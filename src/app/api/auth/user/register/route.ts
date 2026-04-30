import { NextRequest, NextResponse } from "next/server";
import { adminQuery, adminAdd } from "@/lib/firestore-admin";
import { signUserToken, USER_COOKIE } from "@/lib/userAuth";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString("hex");
  const buf  = await scrypt(pw, salt, 64) as Buffer;
  return `scrypt:${salt}:${buf.toString("hex")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { name, age, email, phone, place, password } = body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const existing = await adminQuery("users", "email", email.toLowerCase().trim(), 1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "This email is already registered. Please log in." }, { status: 409 });
    }

    const normalizedPhone = phone?.trim()
      ? (() => {
          const d = phone.replace(/\D/g, "");
          if (d.length === 12 && d.startsWith("91")) return d.slice(2);
          if (d.length === 11 && d.startsWith("0")) return d.slice(1);
          return d;
        })()
      : "";

    if (normalizedPhone && normalizedPhone.length !== 10) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    if (normalizedPhone) {
      const phoneExists = await adminQuery("users", "phone", normalizedPhone, 1);
      if (phoneExists.length > 0) {
        return NextResponse.json({ error: "This phone number is already registered. Please log in." }, { status: 409 });
      }
    }

    const passwordHash = await hashPassword(password);
    const uid = await adminAdd("users", {
      name:          name.trim(),
      age:           age ? Number(age) : null,
      email:         email.toLowerCase().trim(),
      phone:         normalizedPhone,
      place:         place?.trim() ?? "",
      passwordHash,
      createdAt:     new Date().toISOString(),
      contributions: 0,
    });

    const token = await signUserToken({ uid, name: name.trim(), email: email.toLowerCase().trim() });
    const res   = NextResponse.json({ success: true, name: name.trim(), email: email.toLowerCase().trim() });
    res.cookies.set(USER_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    return res;
  } catch (e: unknown) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
