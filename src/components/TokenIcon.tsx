import type { ChainSymbol } from "@/lib/wallet";

const BG: Record<ChainSymbol, string> = {
  DOT: "#e6007a",
  ETH: "#627eea",
  BTC: "#f7931a",
  SOL: "#0a0a12",
  USDT: "#26a17b",
  USDC: "#2775ca",
};

export function TokenIcon({ symbol, size = 32 }: { symbol: ChainSymbol; size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: BG[symbol] }}
    >
      <Logo symbol={symbol} size={size} />
    </div>
  );
}

function Logo({ symbol, size }: { symbol: ChainSymbol; size: number }) {
  const s = size;
  switch (symbol) {
    case "BTC":
      return (
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 32 32" fill="none">
          <path
            fill="#fff"
            d="M21.75 14.45c.3-2-1.22-3.07-3.3-3.79l.68-2.71-1.65-.41-.66 2.64c-.43-.11-.88-.21-1.32-.31l.66-2.66-1.65-.41-.68 2.71c-.36-.08-.71-.16-1.06-.24l-2.27-.57-.44 1.76s1.22.28 1.2.29c.67.17.79.61.77.96l-.77 3.09c.05.01.1.03.17.05-.06-.01-.11-.03-.17-.04l-1.09 4.34c-.08.2-.29.51-.76.39.01.02-1.2-.3-1.2-.3l-.82 1.89 2.14.53c.4.1.79.2 1.17.3l-.69 2.75 1.65.41.68-2.72c.45.12.89.23 1.32.34l-.68 2.71 1.65.41.69-2.74c2.81.53 4.93.32 5.82-2.23.72-2.05-.04-3.24-1.52-4.01 1.08-.25 1.89-.96 2.11-2.43zm-3.78 5.29c-.51 2.05-3.97.94-5.09.66l.91-3.64c1.12.28 4.71.83 4.18 2.98zm.52-5.31c-.47 1.87-3.35.92-4.28.69l.82-3.3c.93.23 3.94.66 3.46 2.61z"
          />
        </svg>
      );
    case "ETH":
      return (
        <svg width={s * 0.55} height={s * 0.65} viewBox="0 0 256 417" fill="none">
          <path fill="#fff" fillOpacity=".6" d="M127.9611 0l-2.7946 9.5v275.668l2.7946 2.79 127.962-75.638z" />
          <path fill="#fff" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
          <path fill="#fff" fillOpacity=".6" d="M127.9611 312.1866l-1.5748 1.9196v98.199l1.5748 4.5955 128.038-180.3898z" />
          <path fill="#fff" d="M127.962 416.9052v-104.72L0 236.5852z" />
          <path fill="#fff" fillOpacity=".3" d="M127.9611 287.9577l127.9611-75.6388-127.9611-58.1618z" />
          <path fill="#fff" fillOpacity=".45" d="M0 212.3189l127.962 75.6388V154.1571z" />
        </svg>
      );
    case "DOT":
      return (
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 100 100" fill="#fff">
          <ellipse cx="50" cy="18" rx="16" ry="10" />
          <ellipse cx="50" cy="82" rx="16" ry="10" />
          <ellipse cx="22" cy="34" rx="16" ry="10" transform="rotate(-60 22 34)" />
          <ellipse cx="78" cy="66" rx="16" ry="10" transform="rotate(-60 78 66)" />
          <ellipse cx="22" cy="66" rx="16" ry="10" transform="rotate(60 22 66)" />
          <ellipse cx="78" cy="34" rx="16" ry="10" transform="rotate(60 78 34)" />
        </svg>
      );
    case "SOL":
      return (
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 128 128" fill="none">
          <defs>
            <linearGradient id="sol-a" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#00ffa3" />
              <stop offset="1" stopColor="#dc1fff" />
            </linearGradient>
          </defs>
          <path
            fill="url(#sol-a)"
            d="M26 84.6c.8-.8 1.8-1.2 3-1.2h87c2 0 3 2.4 1.5 3.8l-17 17c-.8.8-1.8 1.2-3 1.2H10.5c-2 0-3-2.4-1.6-3.8zM26 22.8c.8-.8 1.9-1.2 3-1.2h87c2 0 3 2.4 1.5 3.8l-17 17c-.7.8-1.8 1.2-3 1.2H10.5c-2 0-3-2.4-1.6-3.8zM102 53.5c-.8-.8-1.8-1.2-3-1.2H12c-2 0-3 2.4-1.5 3.8l17 17c.7.8 1.8 1.2 3 1.2h87c2 0 3-2.4 1.5-3.8z"
          />
        </svg>
      );
    case "USDT":
      return (
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 32 32" fill="none">
          <path
            fill="#fff"
            d="M17.92 17.27v-.01c-.12.01-.68.04-1.92.04-.99 0-1.69-.03-1.92-.04v.01c-3.72-.16-6.49-.81-6.49-1.58s2.77-1.42 6.49-1.58v2.51c.24.02.95.06 1.94.06 1.22 0 1.8-.04 1.92-.06V13.1c3.71.16 6.48.81 6.48 1.58s-2.76 1.42-6.48 1.58zm0-3.42v-2.25h5.14V8.16H8.95v3.42h5.14v2.24c-4.17.2-7.31 1.03-7.31 2.01 0 .99 3.13 1.82 7.31 2.01v7.19h3.84v-7.19c4.16-.19 7.29-1.02 7.29-2 0-.99-3.13-1.82-7.29-2.01z"
          />
        </svg>
      );
    case "USDC":
      return (
        <svg width={s * 0.68} height={s * 0.68} viewBox="0 0 32 32" fill="none">
          <path
            fill="#fff"
            d="M16.5 22.2v-1.3c1.83-.24 2.95-1.28 2.95-2.85 0-1.53-.95-2.34-2.93-2.73l-.74-.16V12.4c.82.14 1.35.68 1.48 1.49h1.84c-.13-1.57-1.2-2.6-2.83-2.8v-1.29h-1.05v1.3c-1.73.25-2.8 1.26-2.8 2.76 0 1.4.92 2.22 2.74 2.62l.68.15v3c-.87-.14-1.47-.71-1.6-1.62h-1.86c.1 1.66 1.22 2.71 2.95 2.88v1.31zm-1.05-6.96-.5-.12c-.97-.21-1.42-.58-1.42-1.25 0-.77.58-1.3 1.47-1.4v2.77zm1.66 2.27c1.06.23 1.55.6 1.55 1.37 0 .9-.68 1.5-1.7 1.57v-3zM6.7 16a9.3 9.3 0 0 1 5.93-8.66c.4-.15.6-.5.6-.87 0-.59-.57-1-1.14-.78A11.3 11.3 0 0 0 4.57 16a11.3 11.3 0 0 0 7.52 10.3 .83.83 0 0 0 1.14-.77c0-.37-.2-.73-.6-.88A9.3 9.3 0 0 1 6.7 16zm14.21-10.3a.83.83 0 0 0-1.14.78c0 .37.2.73.6.87a9.3 9.3 0 0 1 0 17.3c-.4.15-.6.5-.6.88 0 .59.57 1 1.14.78A11.3 11.3 0 0 0 28.43 16a11.3 11.3 0 0 0-7.52-10.3z"
          />
        </svg>
      );
  }
}
