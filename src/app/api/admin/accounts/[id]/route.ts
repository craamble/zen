import { NextRequest, NextResponse } from "next/server";
import { deleteAccount, patchAccount } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, string> = {};
  for (const key of ["text1_label", "text2_label", "text3_value", "text4_value"] as const) {
    if (typeof body[key] === "string") patch[key] = body[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  const ok = await patchAccount(id, patch);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await deleteAccount(id);
  return NextResponse.json({ ok: true });
}
