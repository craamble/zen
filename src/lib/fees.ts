// Per-chain fee estimation. Reuses the public RPCs already used for balances/sends.
// Returns the estimated fee in the chain's native units.

import { ethers } from "ethers";
import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
} from "@solana/web3.js";
import type { ChainSymbol } from "./wallet";

const ETH_RPC = "https://cloudflare-eth.com";
const SOL_RPC = "https://api.mainnet-beta.solana.com";

const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

export type FeeEstimate = {
  /** Fee in the chain's native unit (ETH for EVM, SOL for Solana, DOT for Polkadot, BTC for Bitcoin). */
  native: number;
  /** Symbol the fee is denominated in. ERC-20 transfers cost ETH. */
  feeSym: ChainSymbol;
};

async function estimateEthLike(
  sym: "ETH" | "USDT" | "USDC",
  from: string,
  to: string,
  amount: string,
): Promise<FeeEstimate> {
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const feeData = await provider.getFeeData();
  // Prefer EIP-1559 maxFeePerGas; fall back to gasPrice.
  const perGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);

  let gas: bigint;
  if (sym === "ETH") {
    gas = await provider.estimateGas({
      from,
      to,
      value: ethers.parseEther(amount),
    });
  } else {
    const contract = new ethers.Contract(sym === "USDT" ? USDT_ADDR : USDC_ADDR, ERC20_ABI, provider);
    const data = contract.interface.encodeFunctionData("transfer", [
      to,
      ethers.parseUnits(amount, 6),
    ]);
    gas = await provider.estimateGas({ from, to: sym === "USDT" ? USDT_ADDR : USDC_ADDR, data });
  }

  const fee = gas * perGas;
  return { native: Number(ethers.formatEther(fee)), feeSym: "ETH" };
}

async function estimateSol(from: string, to: string, amount: string): Promise<FeeEstimate> {
  const conn = new Connection(SOL_RPC, "confirmed");
  const fromPk = new PublicKey(from);
  const toPk = new PublicKey(to);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: fromPk,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: fromPk,
        toPubkey: toPk,
        lamports: Math.max(1, Math.round(parseFloat(amount) * LAMPORTS_PER_SOL)),
      }),
    ],
  }).compileToV0Message();
  const r = await conn.getFeeForMessage(message, "confirmed");
  const lamports = r.value ?? 5000; // conservative fallback (5000 lamports)
  return { native: lamports / LAMPORTS_PER_SOL, feeSym: "SOL" };
}

async function estimateBtc(from: string, amount: string): Promise<FeeEstimate | null> {
  const BTC_API = "https://mempool.space/api";
  const [utxosRes, feeRes] = await Promise.all([
    fetch(`${BTC_API}/address/${from}/utxo`, { cache: "no-store" }),
    fetch(`${BTC_API}/v1/fees/recommended`, { cache: "no-store" }),
  ]);
  if (!utxosRes.ok) return null;
  const utxos = (await utxosRes.json()) as Array<{ value: number; status: { confirmed: boolean } }>;
  const feeData = feeRes.ok
    ? ((await feeRes.json()) as { halfHourFee?: number; hourFee?: number; fastestFee?: number })
    : { halfHourFee: 5 };
  const feeRate = feeData.halfHourFee ?? feeData.hourFee ?? feeData.fastestFee ?? 5;

  const { selectBtcUtxos } = await import("./send");
  const amountSats = Math.round(parseFloat(amount) * 1e8);
  if (!Number.isFinite(amountSats) || amountSats <= 0) return null;
  const selection = selectBtcUtxos(utxos.map((u) => ({ ...u, txid: "", vout: 0 })), amountSats, feeRate);
  if (!selection) return null;
  return { native: selection.feeSats / 1e8, feeSym: "BTC" };
}

async function estimateDot(from: string, to: string, amount: string): Promise<FeeEstimate> {
  const { withDotApi } = await import("./polkadot-client");
  return withDotApi(async (api) => {
    const planck = BigInt(Math.round(parseFloat(amount) * 1e10));
    const info = await api.tx.balances.transferKeepAlive(to, planck).paymentInfo(from);
    const fee = BigInt(info.partialFee.toString());
    return { native: Number(fee) / 1e10, feeSym: "DOT" };
  });
}

export async function estimateFee(
  sym: ChainSymbol,
  from: string,
  to: string,
  amount: string,
): Promise<FeeEstimate | null> {
  try {
    switch (sym) {
      case "ETH":
      case "USDT":
      case "USDC":
        return await estimateEthLike(sym, from, to, amount);
      case "SOL":
        return await estimateSol(from, to, amount);
      case "DOT":
        return await estimateDot(from, to, amount);
      case "BTC":
        return await estimateBtc(from, amount);
    }
  } catch {
    return null;
  }
}
