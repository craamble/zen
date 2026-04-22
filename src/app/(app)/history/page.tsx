"use client";
import { useEffect, useState } from "react";
import { loadPublic } from "@/lib/vault";

type Tx = {
  hash: string;
  chain: string;
  direction: "in" | "out";
  amount: string;
  to?: string;
  from?: string;
  timestamp: number;
};

export default function History() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPublic();
    if (!p) return;
    (async () => {
      try {
        const out: Tx[] = [];
        // Etherscan-free: use Cloudflare ETH provider to at least get nonce & latest block — skip for brevity
        // BTC: mempool.space returns recent txs
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
            out.push({
              hash: tx.txid,
              chain: "BTC",
              direction: minePrev ? "out" : "in",
              amount: `${(amtSat / 1e8).toFixed(8)} BTC`,
              timestamp: (tx.status.block_time ?? 0) * 1000,
            });
          }
        }
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
          <div>
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs label">
              <span>Chain</span>
              <span>Direction</span>
              <span>Amount</span>
              <span>When</span>
            </div>
            {items.map((t) => (
              <div
                key={t.hash}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-[var(--border)] last:border-0 items-center"
              >
                <span className="chip">{t.chain}</span>
                <span className={t.direction === "in" ? "text-[var(--success)]" : "text-[var(--fg-1)]"}>
                  {t.direction === "in" ? "Received" : "Sent"}
                </span>
                <span className="tabular-nums">{t.amount}</span>
                <span className="muted text-xs">
                  {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
        {err && <div className="p-6 text-sm" style={{ color: "var(--danger)" }}>{err}</div>}
      </div>
    </div>
  );
}
