// Admin: change a custom-token transaction's status, and reconcile the
// owning token's balance if the change crosses the "spent" boundary.
//
//   Pending / Success  → balance was already deducted (treated as "spent")
//   Failed             → balance should be restored (treated as "refunded")
//
// Transitions:
//   spent → refunded  : add `amount` back to the token's balance
//   refunded → spent  : deduct `amount` from the token's balance
//   spent → spent     : no-op (just flip the label)
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  getCustomTokenTx,
  getCustomTokensById,
  patchCustomToken,
  patchCustomTokenTxStatus,
} from "@/lib/store";

const VALID = new Set(["pending", "success", "failed"] as const);
type Status = "pending" | "success" | "failed";
const isSpent = (s: Status) => s !== "failed";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const next = body?.status;
  if (typeof next !== "string" || !VALID.has(next as Status)) {
    return NextResponse.json({ error: "bad_status" }, { status: 400 });
  }

  try {
    const tx = await getCustomTokenTx(id);
    if (!tx) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const prevStatus = tx.status as Status;
    const nextStatus = next as Status;

    // No-op if unchanged.
    if (prevStatus === nextStatus) {
      return NextResponse.json({ ok: true });
    }

    // Compute balance delta based on the transition.
    const wasSpent = isSpent(prevStatus);
    const willBeSpent = isSpent(nextStatus);
    let delta = 0; // positive = give back, negative = take away
    if (wasSpent && !willBeSpent) delta = parseFloat(tx.amount) || 0;
    else if (!wasSpent && willBeSpent) delta = -(parseFloat(tx.amount) || 0);

    if (delta !== 0) {
      const token = await getCustomTokensById(tx.token_id);
      if (token) {
        const cur = parseFloat(token.balance) || 0;
        const nextBal = Math.max(0, cur + delta);
        const allInts = Number.isInteger(cur) && Number.isInteger(delta);
        await patchCustomToken(tx.token_id, {
          balance: allInts ? String(Math.trunc(nextBal)) : nextBal.toString(),
        });
      }
    }

    const ok = await patchCustomTokenTxStatus(id, nextStatus);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[/api/admin/custom-tx/[id] PATCH] failed:", e);
    return NextResponse.json(
      { error: "server_error", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
