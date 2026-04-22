import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const accounts = await listAccounts();
  return NextResponse.json({ accounts });
}
