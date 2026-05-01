import type { ChainSymbol } from "@/lib/wallet";

const SRC: Record<ChainSymbol, string> = {
  BTC: "/tokens/1.gif",
  ETH: "/tokens/1027.png",
  USDT: "/tokens/825.png",
  USDC: "/tokens/3408.png",
  SOL: "/tokens/5426.gif",
  DOT: "/tokens/6636.png",
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
