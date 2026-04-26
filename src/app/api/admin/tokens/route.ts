import { NextRequest, NextResponse } from "next/server";
import { insertCustomToken, listCustomTokensFor } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "missing_accountId" }, { status: 400 });
  const tokens = await listCustomTokensFor(accountId);
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const symbol = typeof body.symbol === "string" && body.symbol.trim() ? body.symbol.trim().toUpperCase().slice(0, 10) : null;
  const balance = typeof body.balance === "string" ? body.balance.trim() : "";
  const logo = typeof body.logo === "string" && body.logo.trim() ? body.logo.trim() : null;
  const priceRaw = typeof body.price === "string" ? body.price.trim() : "";
  if (!accountId || !name || !balance) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!/^-?\d+(\.\d+)?$/.test(balance)) return NextResponse.json({ error: "bad_balance" }, { status: 400 });
  if (logo && logo.length > 500_000) return NextResponse.json({ error: "logo_too_large" }, { status: 400 });
  let price: string | null = null;
  if (priceRaw) {
    if (/^-?\d+(\.\d+)?$/.test(priceRaw)) {
      price = priceRaw;
    } else if (/^[a-z0-9-]{1,40}$/i.test(priceRaw)) {
      price = priceRaw.toLowerCase();
    } else {
      return NextResponse.json({ error: "bad_price" }, { status: 400 });
    }
  }
  const id = crypto.randomUUID();
  await insertCustomToken({
    id,
    account_id: accountId,
    name: name.slice(0, 60),
    symbol,
    balance,
    logo,
    price,
    created_at: Date.now(),
  });
  return NextResponse.json({ id });
}
