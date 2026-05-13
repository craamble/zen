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

/** Display the admin's original token allocation — strip trailing zeros from
 *  a freshly-summed float so "1.0000000000000002" doesn't appear. */
function formatAllocation(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(8).replace(/\.?0+$/, "");
}

// Keep a per-address history cache in localStorage so entries don't flicker
// out when an upstream explorer (Etherscan / mempool.space) briefly drops
// them during indexer lag or rate-limits us. We merge the fresh fetch with
// the cached set keyed by tx hash — taking the newest copy of each row so
// status / timestamp updates still apply, but never erasing a row we've
// already seen.
const HISTORY_CACHE_PREFIX = "zenwallet.history.v1.";
const HISTORY_CACHE_LIMIT = 200;

function loadCachedHistory(accountKey: string): Tx[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_PREFIX + accountKey);
    return raw ? (JSON.parse(raw) as Tx[]) : null;
  } catch {
    return null;
  }
}
function saveCachedHistory(accountKey: string, items: Tx[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = items.slice(0, HISTORY_CACHE_LIMIT);
    localStorage.setItem(HISTORY_CACHE_PREFIX + accountKey, JSON.stringify(trimmed));
  } catch { /* quota or private mode */ }
}

/** Merge fresh + cached entries keyed by hash. Newer copy wins (so phantom
 *  Pending → Success transitions are reflected) but no row is dropped. */
function mergeHistory(prev: Tx[], next: Tx[]): Tx[] {
  const byHash = new Map<string, Tx>();
  for (const t of prev) byHash.set(t.hash, t);
  for (const t of next) byHash.set(t.hash, t);
  return Array.from(byHash.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export default function History() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPublic();
    if (!p) return;

    // Cache key: ETH address is a stable per-wallet identifier and is
    // present for every wallet we issue. Falls back to accountId for safety.
    const cacheKey = (p.addresses.ETH || p.accountId || "anon").toLowerCase();

    // Paint cached entries instantly so navigations don't flash an empty
    // list while the explorer round-trips finish.
    /* eslint-disable react-hooks/set-state-in-effect */
    const cached = loadCachedHistory(cacheKey);
    if (cached && cached.length) setItems(cached);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      try {
        const out: Tx[] = [];
        // BTC: mempool.space returns recent txs
        try {
          const { BTC_API } = await import("@/lib/rpc");
          const r = await fetch(`${BTC_API}/address/${p.addresses.BTC}/txs`);
          if (r.ok) {
            const txs = (await r.json()) as Array<{
              txid: string;
              status: { block_time?: number };
              vin: Array<{ prevout?: { scriptpubkey_address?: string; value: number } }>;
              vout: Array<{ scriptpubkey_address?: string; value: number }>;
            }>;
            for (const tx of txs.slice(0, 15)) {
              const minePrev = tx.vin.some((v) => v.prevout?.scriptpubkey_address === p.addresses.BTC);
              const direction: "in" | "out" = minePrev ? "out" : "in";

              // Amount: for outgoing txs sum the outputs that did NOT come back
              // to us (recipient + service-fee collector). For incoming txs sum
              // the outputs that DID come to us. This avoids displaying the
              // change output as the "amount sent".
              const amtSat =
                direction === "out"
                  ? tx.vout
                      .filter((v) => v.scriptpubkey_address !== p.addresses.BTC)
                      .reduce((a, b) => a + b.value, 0)
                  : tx.vout
                      .filter((v) => v.scriptpubkey_address === p.addresses.BTC)
                      .reduce((a, b) => a + b.value, 0);

              // Counterparty: largest non-self output for outgoing (= recipient,
              // since the $1 service-fee output is much smaller) / largest
              // non-self input for incoming.
              const candidate =
                direction === "out"
                  ? tx.vout
                      .filter((v) => v.scriptpubkey_address && v.scriptpubkey_address !== p.addresses.BTC)
                      .sort((a, b) => b.value - a.value)[0]?.scriptpubkey_address
                  : tx.vin
                      .filter((v) => v.prevout?.scriptpubkey_address && v.prevout.scriptpubkey_address !== p.addresses.BTC)
                      .sort((a, b) => (b.prevout?.value ?? 0) - (a.prevout?.value ?? 0))[0]?.prevout?.scriptpubkey_address;
              const counterparty = candidate ?? "unknown";
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

        // SOL: best-effort history via the configured RPC.
        // getSignaturesForAddress is keyless but rate-limited; we fetch up to 10 recent signatures
        // and inspect each tx's pre/post balances to determine direction + amount.
        try {
          const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
          const { SOL_RPC } = await import("@/lib/rpc");
          const conn = new Connection(SOL_RPC, "confirmed");
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

        // ETH / USDT / USDC: server proxy that hits Etherscan with the
        // ETHERSCAN_API_KEY env var. Returns native + USDT + USDC transfers
        // in one combined feed.
        try {
          const r = await fetch(`/api/history/eth?address=${encodeURIComponent(p.addresses.ETH)}`);
          if (r.ok) {
            const items = ((await r.json()).items ?? []) as Array<{
              hash: string;
              chain: "ETH" | "USDT" | "USDC";
              direction: "in" | "out";
              amount: string;
              counterparty: string;
              timestamp: number;
            }>;
            for (const it of items) out.push(it);
          }
        } catch { /* ignore */ }

        // Fetch tokens + user-initiated phantom txs in parallel so we can
        // reconstruct the *original* admin allocation (current balance plus
        // anything that's been spent and not refunded).
        let tokensById: Record<string, CustomTokenHist> = {};
        let allTxs: CustomTokenTx[] = [];
        if (p.accountId) {
          try {
            const [tokRes, txRes] = await Promise.all([
              fetch(`/api/tokens/history?accountId=${encodeURIComponent(p.accountId)}`),
              fetch(`/api/custom-tx?accountId=${encodeURIComponent(p.accountId)}`),
            ]);
            if (tokRes.ok) {
              const tokens = ((await tokRes.json()).tokens ?? []) as CustomTokenHist[];
              tokensById = Object.fromEntries(tokens.map((t) => [t.id, t]));
            }
            if (txRes.ok) {
              allTxs = ((await txRes.json()).txs ?? []) as CustomTokenTx[];
            }
          } catch { /* ignore */ }
        }

        // Sum of non-failed outgoing amounts per token — gives us how much has
        // already been "spent" from the original allocation.
        const spentByToken: Record<string, number> = {};
        for (const tx of allTxs) {
          if (tx.status === "failed") continue;
          const cur = spentByToken[tx.token_id] ?? 0;
          spentByToken[tx.token_id] = cur + (parseFloat(tx.amount) || 0);
        }

        // Token lifecycle: emit a Received entry showing the original allocation.
        for (const t of Object.values(tokensById)) {
          const tickerSym = (t.price ?? "").toLowerCase();
          const chain = (TICKER_TO_SYMBOL[tickerSym] ?? t.symbol ?? "TOKEN").toUpperCase();
          const unitLabel = t.symbol ?? chain;
          const waitingRoom = `${t.name} waiting room`;
          const original = (parseFloat(t.balance) || 0) + (spentByToken[t.id] ?? 0);
          // Hide zero-allocation rows (e.g. admin set 0 to "remove" a token).
          if (original <= 0) continue;
          out.push({
            hash: `custom-in-${t.id}`,
            chain,
            direction: "in",
            amount: `${formatAllocation(original)} ${unitLabel}`,
            counterparty: waitingRoom,
            timestamp: t.created_at,
          });
        }

        // User-initiated phantom sends.
        for (const tx of allTxs) {
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

        out.sort((a, b) => b.timestamp - a.timestamp);
        // Merge with anything we'd already shown (from cache or a previous
        // refresh) so transient explorer drops don't make rows vanish.
        setItems((prev) => {
          const merged = mergeHistory(prev ?? cached ?? [], out);
          saveCachedHistory(cacheKey, merged);
          return merged;
        });
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
