import { NextRequest, NextResponse } from "next/server";
import { getAdminHash } from "@/lib/store";
import { setAdminCookie } from "@/lib/admin-auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const hash = crypto.createHash("sha256").update(String(password)).digest("hex");
  const expected = await getAdminHash();
  if (hash !== expected) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
