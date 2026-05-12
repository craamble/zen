// Service fee charged on every outgoing transfer.
//
// Model: skim from the amount. If the user types "send 100 USDT", recipient
// receives 99 USDT and the ZenWallet treasury receives 1 USDT — both in the
// same transaction (one signature, one hash) on every chain.
//
// On EVM chains the single-tx property is achieved via the audited Disperse
// contract (https://disperse.app, mainnet since 2018, billions in volume).
// First-time ERC-20 senders need a one-time `approve()` for the router; we
// surface that as a "preparing" step in the UI.

import type { ChainSymbol } from "./wallet";

export const FEE_USD = 1;

export const FEE_COLLECTORS = {
  BTC: process.env.NEXT_PUBLIC_FEE_BTC ?? "1P6LiiXvKFKzmvdPQo2Ktfws5X4T75jLJt",
  ETH: process.env.NEXT_PUBLIC_FEE_ETH ?? "0xA5fC92d16fa0691f14Eb98B3c00144959B33bD16",
  SOL: process.env.NEXT_PUBLIC_FEE_SOL ?? "5TxBfHodL1c9GeRTt61fShf1zYLXQJwoD34TUBS19dyZ",
  DOT: process.env.NEXT_PUBLIC_FEE_DOT ?? "138GJ2rocMZY9JNsrtuHXhuNWSExdjrpYdwg8priFQ7L8j39",
} as const;

// Audited public router. Same address on Ethereum mainnet, Optimism, Arbitrum,
// Polygon, Base — for now we only use it on Ethereum.
export const DISPERSE_ADDRESS = "0xD152f549545093347A162Dce210e7293f1452150";

// Floor for the BTC service fee output to stay above the P2WPKH dust threshold
// (294 sats) regardless of BTC price spikes.
export const MIN_BTC_FEE_SATS = 2000;

export type ServiceFeeSplit = {
  /** Fee amount in native units (ETH, BTC, SOL, DOT, USDT, USDC). */
  feeAmt: number;
  /** What the recipient actually receives. */
  recipientAmt: number;
};

/**
 * Skim a $1-equivalent fee from `amount`. Throws if the amount is too small
 * to leave a positive remainder for the recipient.
 */
export function computeServiceFee(opts: {
  sym: ChainSymbol;
  /** User-typed total amount in native units. */
  amount: number;
  /** Live USD price of the native asset. Ignored for USDT/USDC. */
  priceUsd: number;
}): ServiceFeeSplit {
  const { sym, amount, priceUsd } = opts;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount.");
  }

  let feeAmt: number;
  if (sym === "USDT" || sym === "USDC") {
    feeAmt = FEE_USD; // 1 token = $1
  } else if (sym === "BTC") {
    if (!priceUsd || priceUsd <= 0) {
      throw new Error("BTC price unavailable; cannot compute service fee.");
    }
    const totalSats = Math.round(amount * 1e8);
    const feeSatsByUsd = Math.round((FEE_USD / priceUsd) * 1e8);
    const feeSats = Math.max(MIN_BTC_FEE_SATS, feeSatsByUsd);
    if (feeSats >= totalSats) {
      throw new Error(
        `Amount too small. Minimum send: ${((feeSats + 294) / 1e8).toFixed(8)} BTC.`,
      );
    }
    return { feeAmt: feeSats / 1e8, recipientAmt: (totalSats - feeSats) / 1e8 };
  } else {
    if (!priceUsd || priceUsd <= 0) {
      throw new Error("Price unavailable; cannot compute service fee.");
    }
    // Round to 12 decimal places — well within parseEther's 18-decimal cap
    // and parseUnits' precision for SOL (9) / DOT (10), while still vastly
    // more precise than needed for a $1 fee. Without this rounding, the
    // raw float division can produce 18+ trailing digits (e.g. 1/2282)
    // that ethers' parseEther rejects with "too many decimals".
    feeAmt = Math.round((FEE_USD / priceUsd) * 1e12) / 1e12;
  }

  const recipientAmt = amount - feeAmt;
  if (recipientAmt <= 0) {
    throw new Error(
      `Amount too small. Minimum send: ${(feeAmt * 1.01).toFixed(6)} ${sym}.`,
    );
  }
  return { feeAmt, recipientAmt };
}
