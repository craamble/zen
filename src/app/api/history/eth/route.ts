// Etherscan-backed history proxy. Keeps the API key server-side.
//
// Given an Ethereum address, returns recent native ETH transfers (including
// internal ones — required to surface receives from the Disperse router) and
// ERC-20 transfers filtered to USDT and USDC, merged + deduped, newest first.
//
// Free Etherscan tier is 5 calls/sec, 100k/day — we cache for 15s and serve
// stale-while-revalidate for 60s on the CDN.

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

export const revalidate = 15;

const USDT_ADDR = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDC_ADDR = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const DISPERSE_ADDR = "0xd152f549545093347a162dce210e7293f1452150";
const ERC20_FILTER = new Set([USDT_ADDR, USDC_ADDR]);

const DISPERSE_IFACE = new ethers.Interface([
  "function disperseEther(address[] recipients, uint256[] values) payable",
  "function disperseToken(address token, address[] recipients, uint256[] values)",
]);

type ApiTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError?: string;
  input?: string;
};
type ApiInternalTx = {
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
  const r = await fetch(url, { next: { revalidate: 15 } });
  if (!r.ok) return [];
  const d = (await r.json()) as { status: string; message: string; result: T[] };
  if (d.status !== "1") return [];
  return d.result;
}

function formatAmount(rawWei: string, decimals: number): string {
  const padded = rawWei.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals) || "0";
  const fracPartRaw = decimals > 0 ? padded.slice(-decimals) : "";
  const fracPart = fracPartRaw.replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

/**
 * If `tx.to` is the Disperse contract and `tx.input` decodes to
 * `disperseEther(addresses, values)`, return the first recipient and the
 * amount they actually received. Returns null when the tx is not a Disperse
 * call we recognize.
 */
function decodeDisperseEther(
  tx: ApiTx,
): { recipient: string; amount: bigint } | null {
  if (tx.to.toLowerCase() !== DISPERSE_ADDR) return null;
  if (!tx.input || !tx.input.startsWith("0xe63d38ed")) return null;
  try {
    const parsed = DISPERSE_IFACE.parseTransaction({ data: tx.input, value: tx.value });
    if (!parsed || parsed.name !== "disperseEther") return null;
    const recipients = parsed.args[0] as string[];
    const values = parsed.args[1] as bigint[];
    if (!recipients.length || !values.length) return null;
    return { recipient: recipients[0], amount: values[0] };
  } catch {
    return null;
  }
}

function decodeDisperseToken(
  tx: ApiTokenTx,
): { recipient: string; amount: bigint } | null {
  // ERC-20 events come through tokentx so we don't need to decode the call.
  // We only call this for the outer disperseToken to surface the actual
  // recipient in the sender's view, but tokentx already gives that. Stub.
  void tx;
  return null;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ items: [] });

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return NextResponse.json({ items: [], error: "no_api_key" }, { status: 200 });

  const addrLower = address.toLowerCase();
  const baseUrl = "https://api.etherscan.io/v2/api";
  const common = `chainid=1&address=${address}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${apiKey}`;
  const nativeUrl = `${baseUrl}?module=account&action=txlist&${common}`;
  const internalUrl = `${baseUrl}?module=account&action=txlistinternal&${common}`;
  const tokenUrl = `${baseUrl}?module=account&action=tokentx&${common}`;

  try {
    const [native, internal, tokens] = await Promise.all([
      etherscanJson<ApiTx>(nativeUrl),
      etherscanJson<ApiInternalTx>(internalUrl),
      etherscanJson<ApiTokenTx>(tokenUrl),
    ]);

    const items: HistoryItem[] = [];
    // Track the outer-tx hashes whose ETH amount we've already attributed
    // via Disperse decoding — used to suppress the corresponding internal
    // entries on the sender side (the recipient still sees their internal).
    const sentDispersedTxs = new Set<string>();

    // Native ETH transfers.
    for (const tx of native) {
      if (tx.value === "0") continue;
      if (tx.isError === "1") continue;
      const direction: "in" | "out" = tx.from.toLowerCase() === addrLower ? "out" : "in";

      // Sender side: if this is a disperseEther call, surface the *actual*
      // recipient and the amount they received (rather than "to: Disperse").
      const decoded = direction === "out" ? decodeDisperseEther(tx) : null;
      if (decoded) {
        sentDispersedTxs.add(tx.hash.toLowerCase());
        items.push({
          hash: tx.hash,
          chain: "ETH",
          direction: "out",
          amount: `${formatAmount(decoded.amount.toString(), 18)} ETH`,
          counterparty: decoded.recipient,
          timestamp: parseInt(tx.timeStamp, 10) * 1000,
        });
        continue;
      }

      items.push({
        hash: tx.hash,
        chain: "ETH",
        direction,
        amount: `${formatAmount(tx.value, 18)} ETH`,
        counterparty: direction === "out" ? tx.to : tx.from,
        timestamp: parseInt(tx.timeStamp, 10) * 1000,
      });
    }

    // Internal txs — surface ETH receives forwarded from contracts like
    // Disperse. For the recipient: `from` = Disperse, `to` = recipient. For
    // the sender of a Disperse call, internal entries describe how Disperse
    // forwarded their funds — we already represented that as a single decoded
    // outer entry above, so we filter these out by `sentDispersedTxs`.
    for (const itx of internal) {
      if (itx.value === "0") continue;
      if (itx.isError === "1") continue;
      const isFromMe = itx.from.toLowerCase() === addrLower;
      const isToMe = itx.to.toLowerCase() === addrLower;
      if (!isFromMe && !isToMe) continue;
      if (isFromMe && sentDispersedTxs.has(itx.hash.toLowerCase())) continue;
      const direction: "in" | "out" = isFromMe ? "out" : "in";
      items.push({
        hash: `${itx.hash}-int`,
        chain: "ETH",
        direction,
        amount: `${formatAmount(itx.value, 18)} ETH`,
        counterparty: direction === "out" ? itx.to : itx.from,
        timestamp: parseInt(itx.timeStamp, 10) * 1000,
      });
    }

    // ERC-20 transfers — only USDT and USDC. tokentx already represents the
    // actual recipient + amount (the Transfer events emitted by the token
    // contract), so no extra decoding is needed for Disperse-routed sends.
    for (const tx of tokens) {
      const contract = tx.contractAddress.toLowerCase();
      if (!ERC20_FILTER.has(contract)) continue;
      const sym: "USDT" | "USDC" = contract === USDT_ADDR ? "USDT" : "USDC";
      const fromLower = tx.from.toLowerCase();
      const toLower = tx.to.toLowerCase();
      // Skip the Disperse "user → Disperse" intermediate transfer; the
      // subsequent "Disperse → recipient" Transfer event already represents
      // the user's outgoing send from the sender's perspective.
      if (fromLower === addrLower && toLower === DISPERSE_ADDR) continue;
      const direction: "in" | "out" = fromLower === addrLower ? "out" : "in";
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
      { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } },
    );
  } catch (e) {
    console.error("[/api/history/eth] failed:", e);
    return NextResponse.json({ items: [], error: "fetch_failed" }, { status: 200 });
  }
}
