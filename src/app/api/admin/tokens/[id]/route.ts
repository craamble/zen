import { NextRequest, NextResponse } from "next/server";
import { deleteCustomToken, patchCustomToken } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await deleteCustomToken(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: {
    name?: string;
    symbol?: string | null;
    balance?: string;
    logo?: string | null;
    price?: string | null;
    bucket?: "available" | "locked";
  } = {};

  if (body.bucket === "available" || body.bucket === "locked") {
    patch.bucket = body.bucket;
  }

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    patch.name = v.slice(0, 60);
  }
  if (typeof body.symbol === "string") {
    const v = body.symbol.trim();
    patch.symbol = v ? v.toUpperCase().slice(0, 10) : null;
  }
  if (typeof body.balance === "string") {
    const v = body.balance.trim();
    if (!/^-?\d+(\.\d+)?$/.test(v)) return NextResponse.json({ error: "bad_balance" }, { status: 400 });
    patch.balance = v;
  }
  if (typeof body.logo === "string") {
    const v = body.logo.trim();
    if (v.length > 500_000) return NextResponse.json({ error: "logo_too_large" }, { status: 400 });
    patch.logo = v || null;
  } else if (body.logo === null) {
    patch.logo = null;
  }
  if (typeof body.price === "string") {
    const v = body.price.trim();
    if (!v) {
      patch.price = null;
    } else if (/^-?\d+(\.\d+)?$/.test(v)) {
      patch.price = v;
    } else if (/^[a-z0-9-]{1,40}$/i.test(v)) {
      patch.price = v.toLowerCase();
    } else {
      return NextResponse.json({ error: "bad_price" }, { status: 400 });
    }
  } else if (body.price === null) {
    patch.price = null;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "no_fields" }, { status: 400 });

  const ok = await patchCustomToken(id, patch);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
