"use client";
import { useEffect, useState } from "react";
import { loadPublic } from "@/lib/vault";
import { TokenIcon } from "@/components/TokenIcon";
import type { ChainSymbol } from "@/lib/wallet";

type Tx = {
  hash: string;
  chain: string;
  direction: "in" | "out";
  amount: string;
  counterparty: string;
  timestamp: number;
};

const TICKER_TO_SYMBOL: Record<string, ChainSymbol> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  "usd-coin": "USDC",
  solana: "SOL",
  polkadot: "DOT",
};

const KNOWN_SYMS: ChainSymbol[] = ["BTC", "ETH", "USDT", "USDC", "SOL", "DOT"];

type CustomTokenHist = {
  id: string;
  name: string;
  symbol: string | null;
  balance: string;
  price: string | null;
  deleted_at: number | null;
  created_at: number;
};

function shorten(addr: string, head = 8, tail = 6): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export default function History() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPublic();
    if (!p) return;
    (async () => {
      try {
        const out: Tx[] = [];
        // BTC: mempool.space returns recent txs
        try {
          const r = await fetch(`https://mempool.space/api/address/${p.addresses.BTC}/txs`);
          if (r.ok) {
            const txs = (await r.json()) as Array<{
              txid: string;
              status: { block_time?: number };
              vin: Array<{ prevout?: { scriptpubkey_address?: string; value: number } }>;
              vout: Array<{ scriptpubkey_address?: string; value: number }>;
            }>;
            for (const tx of txs.slice(0, 15)) {
              const minePrev = tx.vin.some((v) => v.prevout?.scriptpubkey_address === p.addresses.BTC);
              const mineOut = tx.vout.some((v) => v.scriptpubkey_address === p.addresses.BTC);
              const amtSat = mineOut
                ? tx.vout
                    .filter((v) => v.scriptpubkey_address === p.addresses.BTC)
                    .reduce((a, b) => a + b.value, 0)
                : tx.vout
                    .filter((v) => v.scriptpubkey_address !== p.addresses.BTC)
                    .reduce((a, b) => a + b.value, 0);
              const direction: "in" | "out" = minePrev ? "out" : "in";
              const counterparty =
                direction === "out"
                  ? tx.vout.find((v) => v.scriptpubkey_address && v.scriptpubkey_address !== p.addresses.BTC)?.scriptpubkey_address ?? "unknown"
                  : tx.vin.find((v) => v.prevout?.scriptpubkey_address && v.prevout.scriptpubkey_address !== p.addresses.BTC)?.prevout?.scriptpubkey_address ?? "unknown";
              out.push({
                hash: tx.txid,
                chain: "BTC",
                direction,
                amount: `${(amtSat / 1e8).toFixed(8)} BTC`,
                counterparty,
                timestamp: (tx.status.block_time ?? 0) * 1000,
              });
            }
          }
        } catch { /* network */ }

        // Custom token history: each row contributes an "in" tx at created_at and (if deleted) an "out" tx at deleted_at.
        if (p.accountId) {
          try {
            const r = await fetch(`/api/tokens/history?accountId=${encodeURIComponent(p.accountId)}`);
            if (r.ok) {
              const tokens = ((await r.json()).tokens ?? []) as CustomTokenHist[];
              for (const t of tokens) {
                const tickerSym = (t.price ?? "").toLowerCase();
                const chain = (TICKER_TO_SYMBOL[tickerSym] ?? t.symbol ?? "TOKEN").toUpperCase();
                const unitLabel = t.symbol ?? chain;
                const waitingRoom = `${t.name} waiting room`;
                out.push({
                  hash: `custom-in-${t.id}`,
                  chain,
                  direction: "in",
                  amount: `${t.balance} ${unitLabel}`,
                  counterparty: waitingRoom,
                  timestamp: t.created_at,
                });
                if (t.deleted_at) {
                  out.push({
                    hash: `custom-out-${t.id}`,
                    chain,
                    direction: "out",
                    amount: `${t.balance} ${unitLabel}`,
                    counterparty: waitingRoom,
                    timestamp: t.deleted_at,
                  });
                }
              }
            }
          } catch { /* ignore */ }
        }

        out.sort((a, b) => b.timestamp - a.timestamp);
        setItems(out);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "failed");
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <div className="glass-card overflow-hidden">
        {items === null && !err && (
          <div className="p-10 flex items-center justify-center gap-3 muted">
            <span className="spinner" /> loading transactions…
          </div>
        )}
        {items && items.length === 0 && (
          <div className="p-10 text-center muted">
            No transactions yet. Showing recent BTC activity; EVM/Solana/Polkadot history requires an
            explorer API key (configure in settings).
          </div>
        )}
        {items && items.length > 0 && (
          <div className="flex flex-col">
            {items.map((t) => {
              const isKnown = (KNOWN_SYMS as string[]).includes(t.chain);
              const isWaitingRoom = t.counterparty.endsWith("waiting room");
              return (
                <div
                  key={t.hash}
                  className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)]/30 transition-colors"
                >
                  {isKnown ? (
                    <TokenIcon symbol={t.chain as ChainSymbol} size={36} />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center text-[10px] font-semibold">
                      {t.chain.slice(0, 3)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        t.direction === "in" ? "text-[var(--success)]" : "text-[var(--fg-0)]"
                      }`}
                    >
                      {t.direction === "in" ? "Received" : "Sent"}
                    </div>
                    <div className="muted text-xs mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="shrink-0">{t.direction === "in" ? "from" : "to"}</span>
                      <span
                        className={`truncate ${isWaitingRoom ? "" : "font-mono"}`}
                        title={t.counterparty}
                      >
                        {isWaitingRoom ? t.counterparty : shorten(t.counterparty)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm tabular-nums font-medium ${
                        t.direction === "in" ? "text-[var(--success)]" : "text-[var(--fg-0)]"
                      }`}
                    >
                      {t.direction === "in" ? "+" : "−"}
                      {t.amount}
                    </div>
                    <div className="muted text-xs mt-0.5">
                      {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {err && <div className="p-6 text-sm" style={{ color: "var(--danger)" }}>{err}</div>}
      </div>
    </div>
  );
}
