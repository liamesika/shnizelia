import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
    return "dev-only-session-secret-change-me-please-0000";
  }
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare HMACs so length differences don't leak.
  return safeEqual(sign(`pw:${input}`), sign(`pw:${expected}`));
}

export async function startAdminSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const i = value.lastIndexOf(".");
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  if (!payload || !safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp * 1000 > Date.now();
}

/** For pages: redirects to the login screen. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** For server actions / route handlers: throws. */
export async function assertAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
