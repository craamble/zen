import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "zw_admin";
const SECRET = process.env.ADMIN_SECRET || "zenwallet-dev-secret-change-me";

export function sign(value: string): string {
  const h = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${h}`;
}
export function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const expected = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  if (signed.slice(idx + 1) !== expected) return null;
  return value;
}

export async function setAdminCookie() {
  const jar = await cookies();
  jar.set(COOKIE, sign(`admin:${Date.now()}`), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}
export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (!v) return false;
  return verify(v) !== null;
}
