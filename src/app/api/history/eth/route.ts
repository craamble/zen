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

/**
 * Decode a `disperseToken(token, recipients[], values[])` outer transaction
 * into the token address it operated on + the first recipient and value
 * (= the actual user destination; the second entry is the ZenWallet treasury).
 */
function decodeDisperseToken(
  tx: ApiTx,
): { tokenAddr: string; recipient: string; amount: bigint } | null {
  if (tx.to.toLowerCase() !== DISPERSE_ADDR) return null;
  if (!tx.input || !tx.input.startsWith("0xc73a2d60")) return null;
  try {
    const parsed = DISPERSE_IFACE.parseTransaction({ data: tx.input, value: tx.value });
    if (!parsed || parsed.name !== "disperseToken") return null;
    const tokenAddr = (parsed.args[0] as string).toLowerCase();
    const recipients = parsed.args[1] as string[];
    const values = parsed.args[2] as bigint[];
    if (!recipients.length || !values.length) return null;
    return { tokenAddr, recipient: recipients[0], amount: values[0] };
  } catch {
    return null;
  }
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
    // Track outer-tx hashes whose ETH transfer we've already attributed
    // via Disperse decoding — used to suppress the corresponding internal
    // ETH entries on the sender side.
    const sentDispersedEthTxs = new Set<string>();

    // Build a lookup of outer `disperseToken` calls so when we see the
    // sender→Disperse Transfer event in tokentx, we can substitute the
    // actual recipient instead of dropping the entry.
    const disperseTokenByHash = new Map<
      string,
      { tokenAddr: string; recipient: string; amount: bigint }
    >();
    for (const tx of native) {
      const decoded = decodeDisperseToken(tx);
      if (decoded) disperseTokenByHash.set(tx.hash.toLowerCase(), decoded);
    }

    // Native ETH transfers.
    for (const tx of native) {
      if (tx.value === "0") continue;
      if (tx.isError === "1") continue;
      const direction: "in" | "out" = tx.from.toLowerCase() === addrLower ? "out" : "in";

      // Sender side: if this is a disperseEther call, surface the *actual*
      // recipient and the amount they received (rather than "to: Disperse").
      const decoded = direction === "out" ? decodeDisperseEther(tx) : null;
      if (decoded) {
        sentDispersedEthTxs.add(tx.hash.toLowerCase());
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
    // outer entry above, so we filter these out by `sentDispersedEthTxs`.
    for (const itx of internal) {
      if (itx.value === "0") continue;
      if (itx.isError === "1") continue;
      const isFromMe = itx.from.toLowerCase() === addrLower;
      const isToMe = itx.to.toLowerCase() === addrLower;
      if (!isFromMe && !isToMe) continue;
      if (isFromMe && sentDispersedEthTxs.has(itx.hash.toLowerCase())) continue;
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

    // ERC-20 transfers — only USDT and USDC.
    //
    // Disperse-routed sends emit three Transfer events on the token contract:
    //   1. sender → Disperse        (the transferFrom that pulled funds in)
    //   2. Disperse → recipient
    //   3. Disperse → treasury
    //
    // Etherscan's tokentx only returns events where the queried address is
    // `from` or `to`. So for the SENDER, only event #1 appears in the feed —
    // and that event's `to` is the Disperse contract, not the actual
    // recipient. We rewrite it to the decoded recipient + amount from the
    // matching `disperseToken` outer call. For the RECIPIENT, only event #2
    // appears — that already has them as `to`, so it renders normally with
    // `from` = Disperse contract as the counterparty.
    for (const tx of tokens) {
      const contract = tx.contractAddress.toLowerCase();
      if (!ERC20_FILTER.has(contract)) continue;
      const sym: "USDT" | "USDC" = contract === USDT_ADDR ? "USDT" : "USDC";
      const fromLower = tx.from.toLowerCase();
      const toLower = tx.to.toLowerCase();
      const decimals = parseInt(tx.tokenDecimal, 10) || 6;

      // Sender side substitution for Disperse-routed sends.
      if (fromLower === addrLower && toLower === DISPERSE_ADDR) {
        const decoded = disperseTokenByHash.get(tx.hash.toLowerCase());
        if (decoded && decoded.tokenAddr === contract) {
          items.push({
            hash: tx.hash,
            chain: sym,
            direction: "out",
            amount: `${formatAmount(decoded.amount.toString(), decimals)} ${sym}`,
            counterparty: decoded.recipient,
            timestamp: parseInt(tx.timeStamp, 10) * 1000,
          });
        }
        continue;
      }

      const direction: "in" | "out" = fromLower === addrLower ? "out" : "in";
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
