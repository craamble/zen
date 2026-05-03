// Per-chain recipient address validation. All checks are local (no network).

import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import * as bitcoin from "bitcoinjs-lib";
import type { ChainSymbol } from "./wallet";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

function validEth(addr: string): ValidationResult {
  if (!ethers.isAddress(addr)) return { ok: false, reason: "Not a valid Ethereum address." };
  return { ok: true };
}

function validSol(addr: string): ValidationResult {
  try {
    const pk = new PublicKey(addr);
    // PublicKey accepts any 32-byte base58 string; reject if it isn't on the ed25519 curve
    // (solana addresses must be on-curve OR a valid PDA — for sending we accept either).
    if (pk.toBase58() !== addr) return { ok: false, reason: "Not a valid Solana address." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Not a valid Solana address." };
  }
}

function validBtc(addr: string): ValidationResult {
  try {
    bitcoin.address.toOutputScript(addr, bitcoin.networks.bitcoin);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Not a valid Bitcoin (mainnet) address." };
  }
}

async function validDot(addr: string): Promise<ValidationResult> {
  try {
    const { decodeAddress, encodeAddress } = await import("@polkadot/util-crypto");
    const decoded = decodeAddress(addr);
    if (decoded.length !== 32) return { ok: false, reason: "Not a valid Polkadot address." };
    // Round-trip back to ss58 to ensure it's well-formed.
    encodeAddress(decoded, 0);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Not a valid Polkadot address." };
  }
}

export async function validateAddress(sym: ChainSymbol, addr: string): Promise<ValidationResult> {
  const v = addr.trim();
  if (!v) return { ok: false, reason: "Address is required." };
  switch (sym) {
    case "ETH":
    case "USDT":
    case "USDC":
      return validEth(v);
    case "SOL":
      return validSol(v);
    case "BTC":
      return validBtc(v);
    case "DOT":
      return validDot(v);
  }
}
