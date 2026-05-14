"use client";
import { useEffect, useState } from "react";
import { IconClose, IconChevron, IconBack } from "./Icons";
import { TokenIcon } from "./TokenIcon";
import type { ChainSymbol } from "@/lib/wallet";
import { decryptMnemonic, loadPublic, loadVault } from "@/lib/vault";
import { validateAddress } from "@/lib/address-validate";
import type { FeeEstimate } from "@/lib/fees";
import { computeServiceFee, type ServiceFeeSplit } from "@/lib/service-fee";
import { useToast } from "./Toast";

const TOKENS: { sym: ChainSymbol; name: string; network: string }[] = [
  { sym: "DOT", name: "Polkadot", network: "Polkadot" },
  { sym: "ETH", name: "Ethereum", network: "Ethereum" },
  { sym: "BTC", name: "Bitcoin", network: "Bitcoin" },
  { sym: "SOL", name: "Solana", network: "Solana" },
  { sym: "USDT", name: "Tether", network: "Ethereum (ERC-20)" },
  { sym: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)" },
];

const HIDE_BALANCES_KEY = "zenwallet.hideBalances.v1";
const MASK = "••••••";

export function SendModal({
  balances,
  onClose,
}: {
  balances: Partial<Record<ChainSymbol, number>>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ChainSymbol | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Hydrate the hide-balances preference from localStorage on mount.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_BALANCES_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

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
                    {hidden ? MASK : (balances[t.sym] ?? 0).toFixed(t.sym === "BTC" ? 6 : 4)}
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
          hidden={hidden}
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
  hidden,
  onBack,
  onClose,
}: {
  sym: ChainSymbol;
  available: number;
  hidden: boolean;
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
  // True when the user clicked the Available chip to "send everything".
  // Cleared as soon as they edit the Amount field manually. When set, doSend
  // silently shaves the chain fee off the broadcast amount so the wallet
  // ends at zero — the displayed Amount stays as the full balance.
  const [maxFlag, setMaxFlag] = useState(false);
  const toast = useToast();
  const token = TOKENS.find((t) => t.sym === sym)!;

  // Fetch prices on mount so the service-fee preview is available in the form step.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.prices) return;
        const flat: Record<string, number> = {};
        for (const k of Object.keys(d.prices)) flat[k] = d.prices[k]?.usd ?? 0;
        setPrices(flat);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-validate the recipient address (debounced) whenever it or the chain changes.
  useEffect(() => {
    const v = to.trim();
    if (!v) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Compute the service-fee split. Skim-from-amount: recipient receives
  // `amount - serviceFee`, treasury receives `serviceFee`. ~$1 worth in the
  // asset's native units.
  let serviceFee: ServiceFeeSplit | null = null;
  let serviceFeeErr: string | null = null;
  if (amtValid) {
    try {
      serviceFee = computeServiceFee({
        sym,
        amount: amtNum,
        priceUsd: prices?.[sym] ?? 0,
      });
    } catch (e) {
      serviceFeeErr = e instanceof Error ? e.message : "Service fee error.";
    }
  }

  const amtErr = amount && !amtValid
    ? "Enter a positive number."
    : amtValid && !maxFlag && amtNum > available
    ? "Amount exceeds available balance."
    : serviceFeeErr;
  const canReview =
    !!to && !addrErr && !addrChecking && amtValid && !amtErr && !!serviceFee;

  // When entering the confirm step, fetch fee estimate + USD prices in parallel.
  useEffect(() => {
    if (step !== "confirm") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Warn if amount + network fee can't fit in the available balance.
  // Only meaningful when the fee asset == the send asset (native sends, not ERC-20s
  // where amount is in USDT/USDC and fee is in ETH). Also suppressed in max-mode:
  // doSend silently shaves the chain fee off the broadcast amount, so amount + fee
  // overshooting the balance is expected and harmless.
  const insufficientForFee =
    !maxFlag && fee && fee !== "loading" && fee !== "failed" && fee.feeSym === sym && amtValid
      ? amtNum + fee.native > available
      : false;

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

      // Max-mode: silently shave the chain network fee (and the chain's
      // existential-deposit reserve, if any — Polkadot's keep_alive guard
      // requires it) off the broadcast amount so the wallet ends as close
      // to zero as the chain will allow. Only applies to native sends;
      // ERC-20 fees come from the user's ETH balance, not the token.
      let broadcastAmount = amount.trim();
      if (
        maxFlag &&
        fee &&
        fee !== "loading" &&
        fee !== "failed" &&
        fee.feeSym === sym
      ) {
        const reserve = fee.keepReserve ?? 0;
        const adjusted = available - fee.native - reserve;
        if (adjusted > 0) {
          // Trim float noise to a precision the chain libs can parse.
          // ETH/SOL/DOT all happily accept ≤12 decimals; BTC accepts ≤8.
          const decimals = sym === "BTC" ? 8 : 12;
          broadcastAmount = adjusted.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
        }
      }

      try {
        const hash = await send(mnemonic, sym, to.trim(), broadcastAmount, {
          feeAmt: serviceFee ? serviceFee.feeAmt.toString() : undefined,
        });
        setResult({ hash });
        setStep("done");
        toast.show("Transaction broadcast");
      } catch (e) {
        // Real broadcast failed (insufficient on-chain balance, RPC reject, etc.).
        // First try the phantom-token fallback — if the user has a matching
        // admin-managed custom token, deduct from the custom balance and log
        // a Pending tx that the admin can later mark Success or Failed.
        const phantomId = await tryPhantomFallback();
        if (phantomId) {
          setResult({ hash: phantomId });
          setStep("done");
          toast.show("Transaction submitted");
        } else {
          // Only surface the original error if we couldn't recover via the
          // phantom path — otherwise the dev-tools overlay pops up for every
          // perfectly-successful phantom send.
          console.error("[doSend] broadcast failed:", {
            sym,
            to: to.trim(),
            typedAmount: amount.trim(),
            broadcastAmount,
            maxFlag,
            feeNative: fee && fee !== "loading" && fee !== "failed" ? fee.native : null,
            keepReserve:
              fee && fee !== "loading" && fee !== "failed" ? fee.keepReserve : null,
            err: e instanceof Error ? { message: e.message, stack: e.stack } : e,
          });
          setResult({ err: "Couldn't broadcast the transaction. Please try again later." });
          setStep("confirm");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Send everything" — fills the Amount field with the user's full available
   * balance and marks the send as max-mode. The displayed amount stays equal
   * to the balance; the chain fee is shaved off silently at broadcast time
   * inside `doSend()` so the wallet ends at zero.
   *
   * For ERC-20 (USDT / USDC) the chain fee is paid separately in ETH, so no
   * adjustment is needed — full balance is the right amount to broadcast.
   */
  function fillMaxAmount() {
    if (available <= 0) return;
    const text = available.toFixed(sym === "BTC" ? 8 : 6).replace(/0+$/, "").replace(/\.$/, "");
    setAmount(text);
    setMaxFlag(true);
  }

  /**
   * Look up an admin-managed custom token whose ticker matches the current chain
   * symbol for this account; if found, deduct the amount from its balance and
   * create a Pending custom-token transaction. Returns the tx id, or null if no
   * matching token exists.
   */
  async function tryPhantomFallback(): Promise<string | null> {
    try {
      const pub = loadPublic();
      const accountId = pub?.accountId;
      if (!accountId) return null;

      // Map this chain symbol to the canonical CoinGecko ticker we use for merging.
      const TICKER_BY_SYMBOL: Partial<Record<ChainSymbol, string>> = {
        BTC: "bitcoin",
        ETH: "ethereum",
        USDT: "tether",
        USDC: "usd-coin",
        SOL: "solana",
        DOT: "polkadot",
      };
      const ticker = TICKER_BY_SYMBOL[sym];
      if (!ticker) return null;

      // Pull the public tokens list and find a candidate:
      //   1. price ticker matches this chain symbol
      //   2. bucket === "available"      (locked tokens are display-only)
      //   3. balance > 0                 (empty tokens can't fund the send)
      // Locked-bucket tokens MUST never be debited via the phantom flow,
      // otherwise the wallet's "Locked balance" stat card lies after the
      // first phantom send. Tokens that meet all three criteria are ranked
      // by balance desc so we always hit the most-funded candidate first.
      const tokensRes = await fetch(`/api/tokens?accountId=${encodeURIComponent(accountId)}`);
      if (!tokensRes.ok) return null;
      const tokens = ((await tokensRes.json()).tokens ?? []) as Array<{
        id: string;
        price: string | null;
        balance: string;
        bucket: "available" | "locked";
      }>;
      const candidates = tokens
        .filter((t) => (t.price ?? "").toLowerCase() === ticker)
        .filter((t) => t.bucket === "available")
        .map((t) => ({ ...t, bal: parseFloat(t.balance) || 0 }))
        .filter((t) => t.bal > 0)
        .sort((a, b) => b.bal - a.bal);
      const match = candidates[0];
      if (!match) return null;

      const r = await fetch("/api/custom-tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          tokenId: match.id,
          amount: amount.trim(),
          to: to.trim(),
        }),
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      return j?.id ?? null;
    } catch {
      return null;
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
          <button
            type="button"
            className="text-right group cursor-pointer disabled:cursor-default"
            onClick={fillMaxAmount}
            disabled={hidden || step !== "form"}
            title="Send everything (subtracts the network fee)"
          >
            <div className="label group-hover:text-[var(--accent)] transition-colors">Available</div>
            <div className="text-sm tabular-nums mt-0.5 group-hover:underline">
              {hidden ? MASK : `${available.toFixed(6)} ${sym}`}
            </div>
          </button>
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
                onChange={(e) => {
                  setAmount(e.target.value);
                  setMaxFlag(false);
                }}
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
              <Row k="Amount" v={<span className="tabular-nums">{amount} {sym}</span>} />
              <Row k="To" v={<span className="font-mono text-xs break-all">{to}</span>} />
              <Row
                k="Network fee"
                v={
                  fee === "loading" ? (
                    <span className="muted inline-flex items-center gap-1.5"><span className="spinner" /> estimating…</span>
                  ) : fee === "failed" || !fee ? (
                    <span className="muted">unavailable</span>
                  ) : fee.feeSym === sym ? (
                    // Native send (BTC, ETH, SOL, DOT): combined chain fee + service fee in one unit.
                    (() => {
                      const combinedNative = fee.native + (serviceFee?.feeAmt ?? 0);
                      const combinedUsd =
                        (feeUsd ?? 0) + (serviceFee ? 1 : 0); // service fee is ~$1
                      return (
                        <span className="tabular-nums">
                          ≈ {combinedNative.toFixed(fee.feeSym === "ETH" ? 6 : 4)} {fee.feeSym}
                          {combinedUsd > 0 && (
                            <span className="muted">
                              {" "}(${combinedUsd.toFixed(combinedUsd < 0.01 ? 4 : 2)})
                            </span>
                          )}
                        </span>
                      );
                    })()
                  ) : (
                    // ERC-20 send: network fee in ETH, service fee in stablecoin — show combined USD.
                    (() => {
                      const combinedUsd = (feeUsd ?? 0) + (serviceFee ? 1 : 0);
                      return (
                        <span className="tabular-nums">
                          ≈ ${combinedUsd.toFixed(combinedUsd < 0.01 ? 4 : 2)}
                        </span>
                      );
                    })()
                  )
                }
              />
            </div>
            {insufficientForFee && (
              <p className="text-xs" style={{ color: "var(--warning)" }}>
                Heads up: amount + network fee exceeds your available balance. The transaction may fail.
              </p>
            )}
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
              <code className="text-[11px] font-mono break-all subtle text-center">{result.hash}</code>
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

/** Per-asset decimal-place defaults for display only. */
function formatAmt(n: number, sym: ChainSymbol): string {
  const decimals = sym === "BTC" ? 8 : sym === "USDT" || sym === "USDC" ? 2 : 6;
  return n.toFixed(decimals);
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
