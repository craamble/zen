"use client";
import { useEffect, useState } from "react";
import { loadPublic } from "@/lib/vault";
import { TokenIcon } from "@/components/TokenIcon";
import type { ChainSymbol } from "@/lib/wallet";
import type { PublicKey as SolPublicKey } from "@solana/web3.js";

type TxStatus = "pending" | "success" | "failed";

type Tx = {
  hash: string;
  chain: string;
  direction: "in" | "out";
  amount: string;
  counterparty: string;
  timestamp: number;
  /** Only set for admin-managed (phantom) transactions. */
  status?: TxStatus;
};

type CustomTokenTx = {
  id: string;
  token_id: string;
  amount: string;
  to_address: string | null;
  status: TxStatus;
  created_at: number;
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

        // SOL: best-effort via the public mainnet-beta RPC.
        // getSignaturesForAddress is keyless but rate-limited; we fetch up to 10 recent signatures
        // and inspect each tx's pre/post balances to determine direction + amount.
        try {
          const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
          const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
          const pk = new PublicKey(p.addresses.SOL);
          const sigs = await conn.getSignaturesForAddress(pk, { limit: 10 });
          // Fetch all txs in parallel — the public RPC tolerates this far better than serial bursts.
          const txs = await Promise.allSettled(
            sigs.map((s) =>
              conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }),
            ),
          );
          for (let si = 0; si < sigs.length; si++) {
            const s = sigs[si];
            const result = txs[si];
            if (result.status !== "fulfilled" || !result.value?.meta || !result.value?.transaction) continue;
            const tx = result.value;
            const meta = tx.meta;
            if (!meta) continue;
            const msg = tx.transaction.message as unknown as {
              staticAccountKeys?: SolPublicKey[];
              accountKeys?: SolPublicKey[];
              getAccountKeys?: () => { staticAccountKeys: SolPublicKey[] };
            };
            const keys: SolPublicKey[] =
              msg.staticAccountKeys ??
              msg.accountKeys ??
              msg.getAccountKeys?.().staticAccountKeys ??
              [];
            const idx = keys.findIndex((k) => k.toBase58() === p.addresses.SOL);
            if (idx === -1) continue;
            const pre = meta.preBalances?.[idx] ?? 0;
            const post = meta.postBalances?.[idx] ?? 0;
            const delta = post - pre;
            if (delta === 0) continue;
            const direction: "in" | "out" = delta > 0 ? "in" : "out";
            let counterparty = "unknown";
            for (let i = 0; i < keys.length; i++) {
              if (i === idx) continue;
              const dPre = meta.preBalances?.[i] ?? 0;
              const dPost = meta.postBalances?.[i] ?? 0;
              const d = dPost - dPre;
              if ((direction === "in" && d < 0) || (direction === "out" && d > 0)) {
                counterparty = keys[i].toBase58();
                break;
              }
            }
            out.push({
              hash: s.signature,
              chain: "SOL",
              direction,
              amount: `${(Math.abs(delta) / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
              counterparty,
              timestamp: (s.blockTime ?? 0) * 1000,
            });
          }
        } catch { /* network or rate limit */ }

        // Custom token lifecycle: each token contributes an "in" tx at
        // created_at (admin issued it). Deleted tokens generate the "out"
        // entry via user-initiated transactions instead (see below).
        let tokensById: Record<string, CustomTokenHist> = {};
        if (p.accountId) {
          try {
            const r = await fetch(`/api/tokens/history?accountId=${encodeURIComponent(p.accountId)}`);
            if (r.ok) {
              const tokens = ((await r.json()).tokens ?? []) as CustomTokenHist[];
              tokensById = Object.fromEntries(tokens.map((t) => [t.id, t]));
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
              }
            }
          } catch { /* ignore */ }
        }

        // User-initiated phantom sends (recorded when a real on-chain
        // broadcast fails and a matching admin-managed token exists).
        if (p.accountId) {
          try {
            const r = await fetch(`/api/custom-tx?accountId=${encodeURIComponent(p.accountId)}`);
            if (r.ok) {
              const txs = ((await r.json()).txs ?? []) as CustomTokenTx[];
              for (const tx of txs) {
                const tok = tokensById[tx.token_id];
                const tickerSym = (tok?.price ?? "").toLowerCase();
                const chain = (TICKER_TO_SYMBOL[tickerSym] ?? tok?.symbol ?? "TOKEN").toUpperCase();
                const unitLabel = tok?.symbol ?? chain;
                out.push({
                  hash: `custom-tx-${tx.id}`,
                  chain,
                  direction: "out",
                  amount: `${tx.amount} ${unitLabel}`,
                  counterparty: tx.to_address || "unknown",
                  timestamp: tx.created_at,
                  status: tx.status,
                });
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
          <div className="p-10 text-center muted text-sm">
            No transactions yet.
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          t.status === "failed"
                            ? "text-[var(--danger)]"
                            : t.direction === "in"
                            ? "text-[var(--success)]"
                            : "text-[var(--fg-0)]"
                        }`}
                      >
                        {t.direction === "in" ? "Received" : "Sent"}
                      </span>
                      {t.status && <StatusBadge status={t.status} />}
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

function StatusBadge({ status }: { status: TxStatus }) {
  const style =
    status === "success"
      ? { color: "var(--success)", borderColor: "var(--success)" }
      : status === "failed"
      ? { color: "var(--danger)", borderColor: "var(--danger)" }
      : { color: "var(--warning)", borderColor: "var(--warning)" };
  return (
    <span
      className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-transparent"
      style={style}
    >
      {status}
    </span>
  );
}
