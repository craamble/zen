"use client";
import { useEffect, useState } from "react";
import { IconClose, IconChevron, IconBack } from "./Icons";
import { TokenIcon } from "./TokenIcon";
import type { ChainSymbol } from "@/lib/wallet";
import { decryptMnemonic, loadPublic, loadVault } from "@/lib/vault";
import { validateAddress } from "@/lib/address-validate";
import type { FeeEstimate } from "@/lib/fees";
import { useToast } from "./Toast";

const TOKENS: { sym: ChainSymbol; name: string; network: string }[] = [
  { sym: "DOT", name: "Polkadot", network: "Polkadot" },
  { sym: "ETH", name: "Ethereum", network: "Ethereum" },
  { sym: "BTC", name: "Bitcoin", network: "Bitcoin" },
  { sym: "SOL", name: "Solana", network: "Solana" },
  { sym: "USDT", name: "Tether", network: "Ethereum (ERC-20)" },
  { sym: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)" },
];

export function SendModal({
  balances,
  onClose,
}: {
  balances: Partial<Record<ChainSymbol, number>>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ChainSymbol | null>(null);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Send">
        <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Send</h2>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="px-5 py-4">
          <p className="muted text-xs mb-3 px-1">Choose a token to send</p>
          <div className="flex flex-col gap-1">
            {TOKENS.map((t) => (
              <button
                key={t.sym}
                className="token-row text-left"
                onClick={() => setSelected(t.sym)}
              >
                <TokenIcon symbol={t.sym} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="muted text-xs truncate">{t.network}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm tabular-nums">
                    {(balances[t.sym] ?? 0).toFixed(t.sym === "BTC" ? 6 : 4)}
                  </div>
                  <div className="muted text-xs">{t.sym}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
      {selected && (
        <SendDetail
          sym={selected}
          available={balances[selected] ?? 0}
          onBack={() => setSelected(null)}
          onClose={onClose}
        />
      )}
    </>
  );
}

function SendDetail({
  sym,
  available,
  onBack,
  onClose,
}: {
  sym: ChainSymbol;
  available: number;
  onBack: () => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "submitting" | "done">("form");
  const [result, setResult] = useState<{ hash?: string; err?: string } | null>(null);
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [addrChecking, setAddrChecking] = useState(false);
  const [fee, setFee] = useState<FeeEstimate | null | "loading" | "failed">(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const toast = useToast();
  const token = TOKENS.find((t) => t.sym === sym)!;

  // Re-validate the recipient address (debounced) whenever it or the chain changes.
  useEffect(() => {
    const v = to.trim();
    if (!v) {
      setAddrErr(null);
      setAddrChecking(false);
      return;
    }
    let cancelled = false;
    setAddrChecking(true);
    const handle = setTimeout(async () => {
      const res = await validateAddress(sym, v);
      if (cancelled) return;
      setAddrErr(res.ok ? null : res.reason);
      setAddrChecking(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [to, sym]);

  const amtNum = parseFloat(amount);
  const amtValid = !!amount && !Number.isNaN(amtNum) && amtNum > 0;
  const amtErr = amount && !amtValid ? "Enter a positive number." : amtValid && amtNum > available ? "Amount exceeds available balance." : null;
  const canReview = !!to && !addrErr && !addrChecking && amtValid && !amtErr;

  // When entering the confirm step, fetch fee estimate + USD prices in parallel.
  useEffect(() => {
    if (step !== "confirm") return;
    let cancelled = false;
    setFee("loading");
    (async () => {
      const pub = loadPublic();
      const fromAddr =
        sym === "BTC"
          ? pub?.addresses.BTC
          : sym === "ETH" || sym === "USDT" || sym === "USDC"
          ? pub?.addresses.ETH
          : sym === "SOL"
          ? pub?.addresses.SOL
          : pub?.addresses.DOT;
      if (!fromAddr) {
        if (!cancelled) setFee("failed");
        return;
      }
      try {
        const [{ estimateFee }, pricesRes] = await Promise.all([
          import("@/lib/fees"),
          fetch("/api/prices").then((r) => r.json()).catch(() => ({ prices: null })),
        ]);
        if (cancelled) return;
        if (pricesRes?.prices) {
          const flat: Record<string, number> = {};
          for (const k of Object.keys(pricesRes.prices)) {
            flat[k] = pricesRes.prices[k]?.usd ?? 0;
          }
          setPrices(flat);
        }
        const f = await estimateFee(sym, fromAddr, to.trim(), amount);
        if (cancelled) return;
        setFee(f ?? "failed");
      } catch {
        if (!cancelled) setFee("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, sym, to, amount]);

  const feeUsd =
    fee && fee !== "loading" && fee !== "failed" && prices?.[fee.feeSym]
      ? fee.native * prices[fee.feeSym]
      : null;

  async function doSend() {
    setBusy(true);
    setResult(null);
    try {
      const vault = loadVault();
      if (!vault) throw new Error("no vault");
      let mnemonic: string;
      try {
        mnemonic = await decryptMnemonic(vault, password);
      } catch {
        setResult({ err: "Wrong password. Please try again." });
        setStep("confirm");
        return;
      }
      const { send } = await import("@/lib/send");
      setStep("submitting");
      const hash = await send(mnemonic, sym, to.trim(), amount.trim());
      setResult({ hash });
      setStep("done");
      toast.show("Transaction broadcast");
    } catch {
      setResult({ err: "Couldn't broadcast the transaction. Please try again later." });
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60] p-4"
      style={{ background: "rgba(5, 7, 12, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-card modal-pop w-full max-w-md p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost !p-1.5" onClick={step === "form" ? onBack : () => setStep("form")} aria-label="Back">
            <IconBack />
          </button>
          <h3 className="text-sm font-medium">Send {sym}</h3>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <TokenIcon symbol={sym} size={44} />
          <div className="flex-1">
            <div className="font-medium">{token.name}</div>
            <div className="muted text-xs">{token.network}</div>
          </div>
          <div className="text-right">
            <div className="label">Available</div>
            <div className="text-sm tabular-nums mt-0.5">{available.toFixed(6)} {sym}</div>
          </div>
        </div>

        {step === "form" && (
          <>
            <div>
              <div className="label mb-1.5">Recipient address</div>
              <input
                className="input font-mono text-xs"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={`${sym} address`}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              {addrErr && (
                <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                  {addrErr}
                </p>
              )}
            </div>
            <div>
              <div className="label mb-1.5">Amount</div>
              <input
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              {amtErr && (
                <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                  {amtErr}
                </p>
              )}
            </div>
            <button
              className="btn btn-primary"
              disabled={!canReview}
              onClick={() => setStep("confirm")}
            >
              Review <IconChevron size={16} />
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="stat-card flex flex-col gap-2 text-sm !p-4">
              <Row k="Asset" v={sym} />
              <Row k="Amount" v={`${amount} ${sym}`} />
              <Row k="To" v={<span className="font-mono text-xs break-all">{to}</span>} />
              <Row
                k="Network fee"
                v={
                  fee === "loading" ? (
                    <span className="muted inline-flex items-center gap-1.5"><span className="spinner" /> estimating…</span>
                  ) : fee === "failed" || !fee ? (
                    <span className="muted">unavailable</span>
                  ) : (
                    <span className="tabular-nums">
                      ≈ {fee.native.toFixed(fee.feeSym === "ETH" ? 6 : 4)} {fee.feeSym}
                      {feeUsd !== null && (
                        <span className="muted"> (${feeUsd.toFixed(feeUsd < 0.01 ? 4 : 2)})</span>
                      )}
                    </span>
                  )
                }
              />
            </div>
            <div>
              <div className="label mb-1.5">Password to sign</div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your wallet password"
                autoFocus
              />
            </div>
            {result?.err && (
              <p className="text-xs" style={{ color: "var(--danger)" }}>
                {result.err}
              </p>
            )}
            <div className="flex gap-2 justify-between">
              <button className="btn btn-ghost" onClick={() => setStep("form")}>
                Back
              </button>
              <button className="btn btn-primary" disabled={!password || busy} onClick={doSend}>
                {busy && <span className="spinner" />} Sign &amp; send
              </button>
            </div>
          </>
        )}

        {step === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="spinner" />
            <p className="text-sm subtle">Broadcasting transaction…</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-12 h-12 rounded-full bg-[var(--success)]/20 flex items-center justify-center">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm">Transaction submitted.</p>
            {result?.hash && (
              <>
                <code className="text-[11px] font-mono break-all subtle text-center">{result.hash}</code>
                {explorerUrl(sym, result.hash) && (
                  <a
                    href={explorerUrl(sym, result.hash) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent)] underline"
                  >
                    View on explorer →
                  </a>
                )}
              </>
            )}
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function explorerUrl(sym: ChainSymbol, hash: string): string | null {
  switch (sym) {
    case "BTC": return `https://mempool.space/tx/${hash}`;
    case "ETH":
    case "USDT":
    case "USDC": return `https://etherscan.io/tx/${hash}`;
    case "SOL": return `https://solscan.io/tx/${hash}`;
    case "DOT": return `https://polkadot.subscan.io/extrinsic/${hash}`;
    default: return null;
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
