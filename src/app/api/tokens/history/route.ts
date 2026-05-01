import { NextRequest, NextResponse } from "next/server";
import { listAllCustomTokensFor } from "@/lib/store";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ tokens: [] });
  const tokens = await listAllCustomTokensFor(accountId);
  return NextResponse.json({ tokens });
}
