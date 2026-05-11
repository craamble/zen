// Admin: list custom-token transactions for a given account.
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listCustomTokenTxsFor } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "missing_accountId" }, { status: 400 });
  const txs = await listCustomTokenTxsFor(accountId);
  return NextResponse.json({ txs });
}
