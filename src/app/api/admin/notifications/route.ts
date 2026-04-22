import { NextRequest, NextResponse } from "next/server";
import { insertNotification } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  const accountId = typeof body.accountId === "string" && body.accountId ? body.accountId : null;
  if (!title || !message) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const id = crypto.randomUUID();
  await insertNotification({
    id,
    account_id: accountId,
    title,
    body: message,
    created_at: Date.now(),
  });
  return NextResponse.json({ id });
}
