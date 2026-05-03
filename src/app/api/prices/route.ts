import { NextResponse } from "next/server";
import { fetchPrices } from "@/lib/prices";

// Server-side cache: re-fetch from CoinGecko at most once per minute.
export const revalidate = 60;

export async function GET() {
  try {
    const prices = await fetchPrices();
    return NextResponse.json(
      { prices },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ prices: null, error: "unavailable" }, { status: 200 });
  }
}
