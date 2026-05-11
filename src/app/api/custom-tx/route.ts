// Public endpoints for the phantom-token transaction log.
//
// GET  ?accountId=...  → list this account's custom-token transactions
// POST                 → user records a "Pending" send (triggered when a real
//                         on-chain broadcast fails and a matching custom token
//                         exists for the chain symbol). Also deducts the amount
//                         from the matching token's balance.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  insertCustomTokenTx,
  listCustomTokenTxsFor,
  listCustomTokensFor,
  patchCustomToken,
} from "@/lib/store";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ txs: [] });
  const txs = await listCustomTokenTxsFor(accountId);
  return NextResponse.json({ txs });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const tokenId = typeof body.tokenId === "string" ? body.tokenId.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const toAddress = typeof body.to === "string" ? body.to.trim() : null;

  if (!accountId || !tokenId || !amount) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!/^-?\d+(\.\d+)?$/.test(amount)) {
    return NextResponse.json({ error: "bad_amount" }, { status: 400 });
  }

  // Verify the token belongs to this account and is still active; deduct balance.
  const tokens = await listCustomTokensFor(accountId);
  const token = tokens.find((t) => t.id === tokenId);
  if (!token) return NextResponse.json({ error: "token_not_found" }, { status: 404 });

  const prev = parseFloat(token.balance) || 0;
  const sent = parseFloat(amount) || 0;
  const next = Math.max(0, prev - sent);
  // Preserve precision when amount and balance are both integers.
  const nextStr = Number.isInteger(prev) && Number.isInteger(sent) ? String(Math.trunc(next)) : next.toString();
  await patchCustomToken(tokenId, { balance: nextStr });

  const now = Date.now();
  const id = crypto.randomUUID();
  await insertCustomTokenTx({
    id,
    account_id: accountId,
    token_id: tokenId,
    direction: "out",
    amount,
    to_address: toAddress,
    status: "pending",
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({ id });
}
