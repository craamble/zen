import { NextResponse } from "next/server";
import { fetchPrices } from "@/lib/prices";

export async function GET() {
  try {
    const prices = await fetchPrices();
    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ prices: null, error: "unavailable" }, { status: 200 });
  }
}
