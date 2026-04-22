import { NextRequest, NextResponse } from "next/server";
import { listCustomTokensFor } from "@/lib/store";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ tokens: [] });
  const tokens = await listCustomTokensFor(accountId);
  return NextResponse.json({ tokens });
}
