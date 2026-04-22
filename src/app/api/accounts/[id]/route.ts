import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/store";

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
