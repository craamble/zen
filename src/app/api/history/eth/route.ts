// Etherscan-backed history proxy. Keeps the API key server-side.
//
// Given an Ethereum address, returns recent native ETH transfers and
// ERC-20 transfers filtered to USDT and USDC, merged and sorted newest first.
//
// Free Etherscan tier is 5 calls/sec, 100k/day — we cache for 60s and serve
// stale-while-revalidate for 5 min on the CDN.

import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

const USDT_ADDR = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDC_ADDR = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const ERC20_FILTER = new Set([USDT_ADDR, USDC_ADDR]);

type ApiTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError?: string;
};
type ApiTokenTx = ApiTx & {
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
};

type HistoryItem = {
  hash: string;
  chain: "ETH" | "USDT" | "USDC";
  direction: "in" | "out";
  amount: string;
  counterparty: string;
  timestamp: number;
};

async function etherscanJson<T>(url: string): Promise<T[]> {
  const r = await fetch(url, { next: { revalidate: 60 } });
  if (!r.ok) return [];
  const d = (await r.json()) as { status: string; message: string; result: T[] };
  if (d.status !== "1") return [];
  return d.result;
}

function formatAmount(rawWei: string, decimals: number): string {
  // Format a base-10 integer string with the given number of decimal places,
  // then trim trailing zeros. No BigInt-to-Number conversion to avoid
  // precision loss for huge balances.
  const padded = rawWei.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals) || "0";
  const fracPartRaw = decimals > 0 ? padded.slice(-decimals) : "";
  const fracPart = fracPartRaw.replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ items: [] });

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return NextResponse.json({ items: [], error: "no_api_key" }, { status: 200 });

  const addrLower = address.toLowerCase();
  const baseUrl = "https://api.etherscan.io/api";
  const common = `address=${address}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${apiKey}`;
  const nativeUrl = `${baseUrl}?module=account&action=txlist&${common}`;
  const tokenUrl = `${baseUrl}?module=account&action=tokentx&${common}`;

  try {
    const [native, tokens] = await Promise.all([
      etherscanJson<ApiTx>(nativeUrl),
      etherscanJson<ApiTokenTx>(tokenUrl),
    ]);

    const items: HistoryItem[] = [];

    // Native ETH transfers — skip zero-value entries (contract-call self-txs).
    for (const tx of native) {
      if (tx.value === "0") continue;
      if (tx.isError === "1") continue;
      const direction: "in" | "out" = tx.from.toLowerCase() === addrLower ? "out" : "in";
      items.push({
        hash: tx.hash,
        chain: "ETH",
        direction,
        amount: `${formatAmount(tx.value, 18)} ETH`,
        counterparty: direction === "out" ? tx.to : tx.from,
        timestamp: parseInt(tx.timeStamp, 10) * 1000,
      });
    }

    // ERC-20 transfers — only USDT and USDC.
    for (const tx of tokens) {
      const contract = tx.contractAddress.toLowerCase();
      if (!ERC20_FILTER.has(contract)) continue;
      const sym: "USDT" | "USDC" = contract === USDT_ADDR ? "USDT" : "USDC";
      const direction: "in" | "out" = tx.from.toLowerCase() === addrLower ? "out" : "in";
      const decimals = parseInt(tx.tokenDecimal, 10) || 6;
      items.push({
        hash: tx.hash,
        chain: sym,
        direction,
        amount: `${formatAmount(tx.value, decimals)} ${sym}`,
        counterparty: direction === "out" ? tx.to : tx.from,
        timestamp: parseInt(tx.timeStamp, 10) * 1000,
      });
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json(
      { items },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    console.error("[/api/history/eth] failed:", e);
    return NextResponse.json({ items: [], error: "fetch_failed" }, { status: 200 });
  }
}
