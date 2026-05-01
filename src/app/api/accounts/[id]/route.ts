import { NextRequest, NextResponse } from "next/server";
import { getAccount, renameAccount } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await getAccount(id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    name: row.name,
    text1: row.text1_label,
    text2: row.text2_label,
    text3: row.text3_value,
    text4: row.text4_value,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "too_long" }, { status: 400 });
  const ok = await renameAccount(id, name);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
