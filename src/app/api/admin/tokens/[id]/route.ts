import { NextRequest, NextResponse } from "next/server";
import { deleteCustomToken } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await deleteCustomToken(id);
  return NextResponse.json({ ok: true });
}
