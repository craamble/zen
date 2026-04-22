"use client";
import { useState } from "react";
import { IconClose, IconCopy, IconCheck, IconChevron, IconBack } from "./Icons";
import { TokenIcon } from "./TokenIcon";
import { QR } from "./QR";
import type { ChainSymbol } from "@/lib/wallet";
import { useToast } from "./Toast";

type Addrs = { DOT: string; ETH: string; BTC: string; SOL: string };

const TOKENS: { sym: ChainSymbol; name: string; network: string }[] = [
  { sym: "DOT", name: "Polkadot", network: "Polkadot" },
  { sym: "ETH", name: "Ethereum", network: "Ethereum" },
  { sym: "BTC", name: "Bitcoin", network: "Bitcoin" },
  { sym: "SOL", name: "Solana", network: "Solana" },
  { sym: "USDT", name: "Tether", network: "Ethereum (ERC-20)" },
  { sym: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)" },
];

function addressFor(sym: ChainSymbol, addrs: Addrs): string {
  if (sym === "USDT" || sym === "USDC") return addrs.ETH;
  return addrs[sym as "DOT" | "ETH" | "BTC" | "SOL"];
}

function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 7)}…${addr.slice(-7)}`;
}

export function ReceiveModal({
  addrs,
  onClose,
}: {
  addrs: Addrs;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ChainSymbol | null>(null);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Receive">
        <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Receive</h2>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="px-5 py-4">
          <p className="muted text-xs mb-3 px-1">Choose a token to receive</p>
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
                <span className="muted">
                  <IconChevron size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
      {selected && (
        <ReceiveDetail
          sym={selected}
          address={addressFor(selected, addrs)}
          onBack={() => setSelected(null)}
          onClose={onClose}
        />
      )}
    </>
  );
}

function ReceiveDetail({
  sym,
  address,
  onBack,
  onClose,
}: {
  sym: ChainSymbol;
  address: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const token = TOKENS.find((t) => t.sym === sym)!;

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.show("Address copied");
    setTimeout(() => setCopied(false), 1500);
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
          <button className="btn btn-ghost !p-1.5" onClick={onBack} aria-label="Back">
            <IconBack />
          </button>
          <h3 className="text-sm font-medium">Receive {sym}</h3>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <TokenIcon symbol={sym} size={52} />
          <div className="text-center">
            <div className="font-medium">{token.name}</div>
            <div className="muted text-xs">{token.network}</div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-xl">
            <QR value={address} size={200} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="label">Your {sym} address</div>
          <div className="flex items-center gap-2">
            <code
              className="font-mono text-sm px-3 py-2 rounded-lg bg-[var(--bg-2)]/50 border border-[var(--border)]"
              title={address}
            >
              {shortenAddress(address)}
            </code>
            <button className="btn !p-2.5 shrink-0" onClick={copy} aria-label="Copy">
              {copied ? <IconCheck /> : <IconCopy />}
            </button>
          </div>
          {(sym === "USDT" || sym === "USDC") && (
            <p className="text-xs mt-1 text-center" style={{ color: "var(--warning)" }}>
              ERC-20 only — send on Ethereum network.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
