// Admin: change a custom-token transaction's status.
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { patchCustomTokenTxStatus } from "@/lib/store";

const VALID = new Set(["pending", "success", "failed"] as const);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (typeof status !== "string" || !VALID.has(status as "pending" | "success" | "failed")) {
    return NextResponse.json({ error: "bad_status" }, { status: 400 });
  }
  const ok = await patchCustomTokenTxStatus(id, status as "pending" | "success" | "failed");
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
