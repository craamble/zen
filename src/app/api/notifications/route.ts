import { NextRequest, NextResponse } from "next/server";
import { listNotificationsFor } from "@/lib/store";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ notifications: [] });
  const notifications = await listNotificationsFor(accountId);
  return NextResponse.json({ notifications });
}
