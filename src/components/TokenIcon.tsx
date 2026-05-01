import type { ChainSymbol } from "@/lib/wallet";

const SRC: Record<ChainSymbol, string> = {
  BTC: "/tokens/btc.png",
  ETH: "/tokens/eth.png",
  USDT: "/tokens/usdt.png",
  USDC: "/tokens/usdc.png",
  SOL: "/tokens/sol.png",
  DOT: "/tokens/dot.png",
};

export function TokenIcon({ symbol, size = 32 }: { symbol: ChainSymbol; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[symbol]}
      alt={symbol}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
