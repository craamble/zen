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
  try {
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

    const tokens = await listCustomTokensFor(accountId);
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) return NextResponse.json({ error: "token_not_found" }, { status: 404 });

    // Defensive: never let a single phantom send exceed the token's current
    // balance. The UI already caps this, but if anything bypasses the cap
    // (race, manual API call, etc.) we'd otherwise inflate the "original
    // allocation" reconstruction in history and confuse the Failed-refund
    // math. Tiny epsilon absorbs float-rounding so a legitimate "send max"
    // of e.g. 1.0000000000000002 still passes.
    const prev = parseFloat(token.balance) || 0;
    const sent = parseFloat(amount) || 0;
    if (sent > prev + 1e-9) {
      return NextResponse.json(
        { error: "amount_exceeds_balance", available: prev },
        { status: 400 },
      );
    }

    // Insert the tx record FIRST. If this fails (e.g. missing table on
    // Supabase) we want to bail out before mutating the token balance,
    // otherwise we end up with a "phantom withdrawal" with no audit row.
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

    // Now safe to deduct the balance.
    const next = Math.max(0, prev - sent);
    const nextStr =
      Number.isInteger(prev) && Number.isInteger(sent)
        ? String(Math.trunc(next))
        : next.toString();
    await patchCustomToken(tokenId, { balance: nextStr });

    return NextResponse.json({ id });
  } catch (e) {
    console.error("[/api/custom-tx POST] failed:", e);
    return NextResponse.json(
      { error: "server_error", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
