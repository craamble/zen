"use client";
import { useEffect, useState } from "react";
import { loadPublic, type PublicState } from "@/lib/vault";
import { TokenIcon } from "@/components/TokenIcon";
import { IconReceive, IconSend, IconEye, IconEyeOff, IconRefresh } from "@/components/Icons";
import { ReceiveModal } from "@/components/ReceiveModal";
import { SendModal } from "@/components/SendModal";
import type { ChainSymbol } from "@/lib/wallet";
import type { PriceMap } from "@/lib/prices";

const SYMBOLS: ChainSymbol[] = ["DOT", "ETH", "BTC", "SOL", "USDT", "USDC"];

const TICKER_TO_SYMBOL: Record<string, ChainSymbol> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  "usd-coin": "USDC",
  solana: "SOL",
  polkadot: "DOT",
};

const ICON_BY_SYMBOL: Record<string, string> = {
  BTC: "/tokens/1.gif",
  ETH: "/tokens/1027.png",
  USDT: "/tokens/825.png",
  USDC: "/tokens/3408.png",
  SOL: "/tokens/5426.gif",
  DOT: "/tokens/6636.png",
};

type CustomToken = {
  id: string;
  name: string;
  symbol: string | null;
  balance: string;
  logo: string | null;
  price: string | null;
};

type ExtraPrice = { usd: number; change24h: number };

const HIDE_BALANCES_KEY = "zenwallet.hideBalances.v1";
const BALANCES_CACHE_KEY = "zenwallet.balances.v1";
const PRICES_CACHE_KEY = "zenwallet.prices.v1";

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota or private mode */ }
}

export default function Portfolio() {
  const [pub, setPub] = useState<PublicState | null>(null);
  const [prices, setPrices] = useState<PriceMap | null>(null);
  const [balances, setBalances] = useState<Record<ChainSymbol, number> | null>(null);
  const [loadingBal, setLoadingBal] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [textFields, setTextFields] = useState<{ text1: string; text2: string; text3: string; text4: string } | null>(null);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [extraPrices, setExtraPrices] = useState<Record<string, ExtraPrice>>({});
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function refresh(p: PublicState) {
    setRefreshing(true);
    setLoadingBal(true);
    const tasks: Promise<unknown>[] = [];

    tasks.push(
      fetch("/api/prices")
        .then((r) => r.json())
        .then((d) => {
          if (d.prices) {
            setPrices(d.prices);
            writeCache(PRICES_CACHE_KEY, d.prices);
          }
        })
        .catch(() => {}),
    );

    if (p.accountId) {
      tasks.push(
        fetch(`/api/accounts/${p.accountId}`)
          .then((r) => r.json())
          .then((d) => setTextFields({ text1: d.text1, text2: d.text2, text3: d.text3, text4: d.text4 }))
          .catch(() => {}),
      );
      tasks.push(
        fetch(`/api/tokens?accountId=${encodeURIComponent(p.accountId)}`)
          .then((r) => r.json())
          .then(async (d) => {
            const tokens: CustomToken[] = d.tokens ?? [];
            setCustomTokens(tokens);
            const ids = Array.from(
              new Set(
                tokens
                  .map((t) => t.price)
                  .filter((v): v is string => !!v && !/^-?\d+(\.\d+)?$/.test(v)),
              ),
            );
            if (ids.length) {
              try {
                const dd = await fetch(`/api/prices/lookup?ids=${encodeURIComponent(ids.join(","))}`).then((r) => r.json());
                setExtraPrices(dd.prices ?? {});
              } catch { /* ignore */ }
            } else {
              setExtraPrices({});
            }
          })
          .catch(() => {}),
      );
    }

    tasks.push(
      import("@/lib/balances").then(({ getAllBalances }) =>
        getAllBalances(p.addresses)
          .then((b) => {
            setBalances(b);
            writeCache(BALANCES_CACHE_KEY, b);
          })
          .catch(() => setBalances((prev) => prev ?? { DOT: 0, ETH: 0, BTC: 0, SOL: 0, USDT: 0, USDC: 0 }))
          .finally(() => setLoadingBal(false)),
      ),
    );

    Promise.allSettled(tasks).finally(() => setRefreshing(false));
  }

  useEffect(() => {
    const p = loadPublic();
    setPub(p);
    setHidden(localStorage.getItem(HIDE_BALANCES_KEY) === "1");
    // Paint cached balances/prices instantly so the page isn't all zeros while RPCs run.
    const cachedBal = readCache<Record<ChainSymbol, number>>(BALANCES_CACHE_KEY);
    if (cachedBal) {
      setBalances(cachedBal);
      setLoadingBal(false);
    }
    const cachedPrices = readCache<PriceMap>(PRICES_CACHE_KEY);
    if (cachedPrices) setPrices(cachedPrices);
    if (p) refresh(p);
  }, []);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(HIDE_BALANCES_KEY, next ? "1" : "0");
  }

  const mask = "••••••";

  if (!pub) return <div className="spinner" />;

  // Split custom tokens into those that merge with built-in chain symbols vs standalone.
  const customAdds: Record<ChainSymbol, number> = { DOT: 0, ETH: 0, BTC: 0, SOL: 0, USDT: 0, USDC: 0 };
  const standalone: CustomToken[] = [];
  for (const t of customTokens) {
    const tk = (t.price ?? "").toLowerCase();
    const mappedSym = tk in TICKER_TO_SYMBOL ? TICKER_TO_SYMBOL[tk] : null;
    if (mappedSym) {
      customAdds[mappedSym] += parseFloat(t.balance) || 0;
    } else {
      standalone.push(t);
    }
  }

  const onChainRows = SYMBOLS.map((s) => {
    const price = prices?.[s]?.usd ?? 0;
    const onChainBal = balances?.[s] ?? 0;
    const mergedBal = onChainBal + customAdds[s];
    const onChainValue = price * onChainBal;
    const customValue = price * customAdds[s];
    const value = price * mergedBal;
    const change = prices?.[s]?.change24h ?? 0;
    return { sym: s, price, bal: mergedBal, onChainBal, value, onChainValue, customValue, change };
  });

  function resolveCustom(t: CustomToken): { price: number; change: number } {
    if (!t.price) return { price: 0, change: 0 };
    if (/^-?\d+(\.\d+)?$/.test(t.price)) return { price: parseFloat(t.price), change: 0 };
    const p = extraPrices[t.price];
    return { price: p?.usd ?? 0, change: p?.change24h ?? 0 };
  }
  const standaloneRows = standalone.map((t) => {
    const bal = parseFloat(t.balance) || 0;
    const { price, change } = resolveCustom(t);
    return { token: t, bal, price, change, value: price * bal };
  });

  const onChainTotal = onChainRows.reduce((a, r) => a + r.onChainValue, 0);
  const customTotal =
    onChainRows.reduce((a, r) => a + r.customValue, 0) +
    standaloneRows.reduce((a, r) => a + r.value, 0);
  const totalValue = onChainTotal + customTotal;

  onChainRows.forEach((r) => ((r as any).pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0));
  standaloneRows.forEach((r) => ((r as any).pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0));

  const sendBalances: Record<ChainSymbol, number> = {
    DOT: onChainRows.find((r) => r.sym === "DOT")!.bal,
    ETH: onChainRows.find((r) => r.sym === "ETH")!.bal,
    BTC: onChainRows.find((r) => r.sym === "BTC")!.bal,
    SOL: onChainRows.find((r) => r.sym === "SOL")!.bal,
    USDT: onChainRows.find((r) => r.sym === "USDT")!.bal,
    USDC: onChainRows.find((r) => r.sym === "USDC")!.bal,
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-3">
          <div>
            <div className="label">Portfolio</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">Overview</h1>
          </div>
          <div className="flex gap-1 mb-1">
            <button
              className="btn btn-ghost !p-2"
              aria-label={hidden ? "Show balances" : "Hide balances"}
              title={hidden ? "Show balances" : "Hide balances"}
              onClick={toggleHidden}
            >
              {hidden ? <IconEye size={18} /> : <IconEyeOff size={18} />}
            </button>
            <button
              className="btn btn-ghost !p-2"
              aria-label="Refresh balances"
              title="Refresh balances"
              disabled={refreshing}
              onClick={() => pub && refresh(pub)}
            >
              <IconRefresh size={18} className={refreshing ? "spin" : undefined} />
            </button>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button className="btn" onClick={() => setReceiveOpen(true)}>
            <IconReceive size={16} /> Receive
          </button>
          <button className="btn btn-primary" onClick={() => setSendOpen(true)}>
            <IconSend size={16} /> Send
          </button>
        </div>
      </div>

      <section className="glass-card p-4 md:p-5 flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 md:gap-6">
        <div>
          <div className="label">Total balance</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="muted text-lg font-medium">$</span>
            <span className="text-[1.75rem] md:text-[2.25rem] leading-none font-semibold tabular-nums tracking-tight break-all">
              {hidden
                ? mask
                : totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 md:ml-auto w-full md:w-auto">
          <div className="stat-card w-full sm:w-[180px] md:w-[250px]">
            <div className="label">{textFields?.text1 ?? "Available balance"}</div>
            <div className="text-base font-medium mt-1 break-all">
              {hidden
                ? mask
                : textFields?.text3 && textFields.text3 !== "—"
                ? textFields.text3
                : `$${onChainTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
          <div className="stat-card w-full sm:w-[180px] md:w-[250px]">
            <div className="label">{textFields?.text2 ?? "Locked balance"}</div>
            <div className="text-base font-medium mt-1 break-all">
              {hidden
                ? mask
                : textFields?.text4 && textFields.text4 !== "—"
                ? textFields.text4
                : `$${customTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Tokens</h2>
          {loadingBal && <span className="chip"><span className="spinner" /> loading balances</span>}
        </div>
        <div className="glass-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr] px-6 py-3 border-b border-[var(--border)] text-xs label">
            <span>Token</span>
            <span>Portfolio %</span>
            <span>Price</span>
            <span className="text-right">Balance</span>
          </div>
          {onChainRows.map((r) => (
            <div
              key={r.sym}
              className="grid grid-cols-[1.4fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] last:border-b-0 items-center hover:bg-[var(--bg-2)]/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TokenIcon symbol={r.sym} size={36} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{TOKEN_NAMES[r.sym]}</div>
                  <div className="muted text-xs">
                    <span className="sm:hidden">${r.price.toFixed(r.price < 1 ? 4 : 2)}</span>
                    <span className="hidden sm:inline">{r.sym}</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block tabular-nums">
                {((r as any).pct as number).toFixed(1)}%
              </div>
              <div className="hidden sm:block tabular-nums">
                <div>${r.price.toFixed(r.price < 1 ? 4 : 2)}</div>
                {r.change !== 0 && (
                  <div
                    className="text-xs"
                    style={{ color: r.change >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}%
                  </div>
                )}
              </div>
              <div className="text-right tabular-nums">
                <div>{hidden ? mask : `${r.bal.toFixed(r.sym === "BTC" ? 8 : 4)} ${r.sym}`}</div>
                <div className="muted text-xs">{hidden ? mask : `$${r.value.toFixed(2)}`}</div>
              </div>
            </div>
          ))}
          {standaloneRows.map((r) => {
            const t = r.token;
            return (
              <div
                key={t.id}
                className="grid grid-cols-[1.4fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] last:border-b-0 items-center hover:bg-[var(--bg-2)]/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CustomLogo logo={t.logo} symbol={t.symbol} name={t.name} size={36} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="muted text-xs">
                      <span className="sm:hidden">{r.price > 0 ? `$${r.price.toFixed(r.price < 1 ? 4 : 2)}` : (t.symbol ?? "—")}</span>
                      <span className="hidden sm:inline">{t.symbol ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block tabular-nums">
                  {((r as any).pct as number).toFixed(1)}%
                </div>
                <div className="hidden sm:block tabular-nums">
                  {r.price > 0 ? (
                    <>
                      <div>${r.price.toFixed(r.price < 1 ? 4 : 2)}</div>
                      {r.change !== 0 && (
                        <div
                          className="text-xs"
                          style={{ color: r.change >= 0 ? "var(--success)" : "var(--danger)" }}
                        >
                          {r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}%
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div>{hidden ? mask : `${r.bal} ${t.symbol ?? ""}`}</div>
                  {r.value > 0 && (
                    <div className="muted text-xs">{hidden ? mask : `$${r.value.toFixed(2)}`}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {receiveOpen && (
        <ReceiveModal addrs={pub.addresses} onClose={() => setReceiveOpen(false)} />
      )}
      {sendOpen && (
        <SendModal
          balances={sendBalances}
          onClose={() => setSendOpen(false)}
        />
      )}
    </div>
  );
}

const TOKEN_NAMES: Record<ChainSymbol, string> = {
  DOT: "Polkadot",
  ETH: "Ethereum",
  BTC: "Bitcoin",
  SOL: "Solana",
  USDT: "Tether",
  USDC: "USD Coin",
};

function CustomLogo({
  logo,
  symbol,
  name,
  size,
}: {
  logo: string | null;
  symbol: string | null;
  name: string;
  size: number;
}) {
  const [errored, setErrored] = useState(false);
  const key = (logo ?? "").toUpperCase();
  const src = ICON_BY_SYMBOL[key];
  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setErrored(true)}
      />
    );
  }
  const letter = (symbol || name || "?")[0]?.toUpperCase() ?? "?";
  return (
    <span
      className="shrink-0 rounded-full bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {letter}
    </span>
  );
}
