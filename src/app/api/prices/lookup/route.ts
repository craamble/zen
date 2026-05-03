import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]{1,40}$/.test(s));
  if (!ids.length) return NextResponse.json({ prices: {} });
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids.join(","),
    )}&vs_currencies=usd&include_24hr_change=true`;
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return NextResponse.json({ prices: {} });
    const data = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const prices: Record<string, { usd: number; change24h: number }> = {};
    for (const id of ids) {
      const p = data[id];
      if (p) prices[id] = { usd: p.usd ?? 0, change24h: p.usd_24h_change ?? 0 };
    }
    return NextResponse.json(
      { prices },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ prices: {} });
  }
}
