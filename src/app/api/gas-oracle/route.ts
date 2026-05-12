// Server-side proxy for Etherscan's gas oracle. Keeps the API key out of
// the browser bundle. Returns `{ fastGwei, baseFeeGwei }` or `null` values
// when the upstream is unreachable.

import { NextResponse } from "next/server";

export const revalidate = 15;

export async function GET() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fastGwei: null, baseFeeGwei: null });
  }
  try {
    const r = await fetch(
      `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${apiKey}`,
      { next: { revalidate: 15 } },
    );
    if (!r.ok) return NextResponse.json({ fastGwei: null, baseFeeGwei: null });
    const d = (await r.json()) as {
      result?: { FastGasPrice?: string; suggestBaseFee?: string };
    };
    const fastGwei = parseFloat(d?.result?.FastGasPrice ?? "");
    const baseFeeGwei = parseFloat(d?.result?.suggestBaseFee ?? "");
    return NextResponse.json(
      {
        fastGwei: Number.isFinite(fastGwei) && fastGwei > 0 ? fastGwei : null,
        baseFeeGwei: Number.isFinite(baseFeeGwei) && baseFeeGwei > 0 ? baseFeeGwei : null,
      },
      { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ fastGwei: null, baseFeeGwei: null });
  }
}
