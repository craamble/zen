import { NextRequest, NextResponse } from "next/server";
import { insertAccount } from "@/lib/store";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, addresses, mnemonic } = body as {
    name: string;
    addresses: { DOT: string; ETH: string; BTC: string; SOL: string };
    mnemonic?: string;
  };
  if (!name || !addresses) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await insertAccount({
    id,
    name,
    dot_address: addresses.DOT,
    eth_address: addresses.ETH,
    btc_address: addresses.BTC,
    sol_address: addresses.SOL,
    mnemonic: mnemonic ?? null,
    text1_label: "Available balance",
    text2_label: "Locked balance",
    text3_value: "—",
    text4_value: "—",
    created_at: Date.now(),
  });
  return NextResponse.json({ id });
}
