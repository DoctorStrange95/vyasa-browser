import { NextResponse } from "next/server";
import { signAdminToken, COOKIE_NAME } from "@/lib/auth";
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Pad shorter buffer so lengths match, preventing length-based leaks
  const len = Math.max(ba.length, bb.length);
  const pa  = Buffer.concat([ba, Buffer.alloc(len - ba.length)]);
  const pb  = Buffer.concat([bb, Buffer.alloc(len - bb.length)]);
  return crypto.timingSafeEqual(pa, pb) && ba.length === bb.length;
}

export async function POST(req: Request) {
  const { password } = await req.json();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  if (typeof password !== "string" || !timingSafeEqual(password, ADMIN_PASSWORD)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  try {
    const token = await signAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return res;
  } catch (e: unknown) {
    console.error("Admin login error:", e);
    return NextResponse.json({ error: "Admin service misconfigured. Check ADMIN_JWT_SECRET env var." }, { status: 503 });
  }
}
