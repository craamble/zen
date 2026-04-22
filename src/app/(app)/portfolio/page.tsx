"use client";
import { useEffect, useState } from "react";
import { loadPublic, type PublicState } from "@/lib/vault";
import { TokenIcon } from "@/components/TokenIcon";
import { IconReceive, IconSend } from "@/components/Icons";
import { ReceiveModal } from "@/components/ReceiveModal";
import { SendModal } from "@/components/SendModal";
import type { ChainSymbol } from "@/lib/wallet";
import type { PriceMap } from "@/lib/prices";

const SYMBOLS: ChainSymbol[] = ["DOT", "ETH", "BTC", "SOL", "USDT", "USDC"];

type CustomToken = {
  id: string;
  name: string;
  symbol: string | null;
  balance: string;
  logo: string | null;
};

export default function Portfolio() {
  const [pub, setPub] = useState<PublicState | null>(null);
  const [prices, setPrices] = useState<PriceMap | null>(null);
  const [balances, setBalances] = useState<Record<ChainSymbol, number> | null>(null);
  const [loadingBal, setLoadingBal] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [textFields, setTextFields] = useState<{ text1: string; text2: string; text3: string; text4: string } | null>(null);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);

  useEffect(() => {
    const p = loadPublic();
    setPub(p);
    fetch("/api/prices").then((r) => r.json()).then((d) => setPrices(d.prices));
    if (p?.accountId) {
      fetch(`/api/accounts/${p.accountId}`)
        .then((r) => r.json())
        .then((d) => setTextFields({ text1: d.text1, text2: d.text2, text3: d.text3, text4: d.text4 }))
        .catch(() => {});
      fetch(`/api/tokens?accountId=${encodeURIComponent(p.accountId)}`)
        .then((r) => r.json())
        .then((d) => setCustomTokens(d.tokens ?? []))
        .catch(() => {});
    }
    if (p) {
      import("@/lib/balances").then(({ getAllBalances }) => {
        getAllBalances(p.addresses)
          .then(setBalances)
          .catch(() => setBalances({ DOT: 0, ETH: 0, BTC: 0, SOL: 0, USDT: 0, USDC: 0 }))
          .finally(() => setLoadingBal(false));
      });
    }
  }, []);

  if (!pub) return <div className="spinner" />;

  const rows = SYMBOLS.map((s) => {
    const price = prices?.[s]?.usd ?? 0;
    const bal = balances?.[s] ?? 0;
    const value = price * bal;
    const change = prices?.[s]?.change24h ?? 0;
    return { sym: s, price, bal, value, change };
  });
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  rows.forEach((r) => ((r as any).pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0));

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label">Portfolio</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Overview</h1>
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

      <section className="glass-card p-5 flex flex-wrap items-center gap-6">
        <div>
          <div className="label">Total balance</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="muted text-lg font-medium">$</span>
            <span className="text-[2.25rem] leading-none font-semibold tabular-nums tracking-tight">
              {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div className="flex gap-3 ml-auto">
          <div className="stat-card w-[250px]">
            <div className="label">{textFields?.text1 ?? "24h Change"}</div>
            <div className="text-base font-medium mt-1">
              {textFields?.text3 ?? "—"}
            </div>
          </div>
          <div className="stat-card w-[250px]">
            <div className="label">{textFields?.text2 ?? "7d Change"}</div>
            <div className="text-base font-medium mt-1">
              {textFields?.text4 ?? "—"}
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
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-6 py-3 border-b border-[var(--border)] text-xs label">
            <span>Token</span>
            <span>Portfolio %</span>
            <span>Price</span>
            <span className="text-right">Balance</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.sym}
              className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-6 py-4 border-b border-[var(--border)] last:border-b-0 items-center hover:bg-[var(--bg-2)]/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={r.sym} size={36} />
                <div>
                  <div className="font-medium">{TOKEN_NAMES[r.sym]}</div>
                  <div className="muted text-xs">{r.sym}</div>
                </div>
              </div>
              <div className="tabular-nums">
                {((r as any).pct as number).toFixed(1)}%
              </div>
              <div className="tabular-nums">
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
                <div>{r.bal.toFixed(r.sym === "BTC" ? 8 : 4)} {r.sym}</div>
                <div className="muted text-xs">${r.value.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {customTokens.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-6 py-4 border-b border-[var(--border)] last:border-b-0 items-center hover:bg-[var(--bg-2)]/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold">
                    {(t.symbol || t.name)[0]?.toUpperCase()}
                  </span>
                )}
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="muted text-xs">{t.symbol ?? "—"}</div>
                </div>
              </div>
              <div className="muted">—</div>
              <div className="muted">—</div>
              <div className="text-right tabular-nums">
                <div>{t.balance} {t.symbol ?? ""}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {receiveOpen && (
        <ReceiveModal addrs={pub.addresses} onClose={() => setReceiveOpen(false)} />
      )}
      {sendOpen && (
        <SendModal
          balances={balances ?? {}}
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
