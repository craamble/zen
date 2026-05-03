import type { ChainSymbol } from "./wallet";

const COINGECKO_IDS: Record<ChainSymbol, string> = {
  DOT: "polkadot",
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana",
  USDT: "tether",
  USDC: "usd-coin",
};

export type PriceMap = Record<ChainSymbol, { usd: number; change24h: number }>;

export async function fetchPrices(): Promise<PriceMap> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const r = await fetch(url, { next: { revalidate: 60 } });
  if (!r.ok) throw new Error("price fetch failed");
  const data = await r.json();
  const out = {} as PriceMap;
  (Object.keys(COINGECKO_IDS) as ChainSymbol[]).forEach((sym) => {
    const id = COINGECKO_IDS[sym];
    const p = data[id];
    out[sym] = {
      usd: p?.usd ?? 0,
      change24h: p?.usd_24h_change ?? 0,
    };
  });
  return out;
}
