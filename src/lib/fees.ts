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
import { DISPERSE_ADDRESS, FEE_COLLECTORS } from "./service-fee";
import { ETH_RPC, SOL_RPC } from "./rpc";

const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DISPERSE_ABI = [
  "function disperseEther(address[] recipients, uint256[] values) payable",
];

// Conservative gas estimates for Disperse-routed ERC-20 sends. We can't run
// estimateGas against the Disperse contract without a pre-existing allowance
// (the transferFrom call would revert), so we use empirical upper bounds.
const ERC20_DISPERSE_GAS = BigInt(150_000); // disperseToken w/ 2 recipients
const ERC20_APPROVE_GAS = BigInt(60_000);   // one-time, first-ever ERC-20 send

export type FeeEstimate = {
  /** Fee in the chain's native unit (ETH for EVM, SOL for Solana, DOT for Polkadot, BTC for Bitcoin). */
  native: number;
  /** Symbol the fee is denominated in. ERC-20 transfers cost ETH. */
  feeSym: ChainSymbol;
  /** Amount of the native asset that must remain in the sender's account
   * after a "send max" transfer. Used to avoid hitting Polkadot's
   * `keep_alive` / existential-deposit guard. Zero / undefined for chains
   * that allow draining to zero. */
  keepReserve?: number;
};

async function fetchFastGasPriceWei(): Promise<bigint | null> {
  // Etherscan's gas oracle is more authoritative for "what gas price will
  // actually land in the next block" than ethers' getFeeData(), which leans
  // conservative. We use FastGasPrice (gwei) when available.
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch(
      `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${apiKey}`,
      { next: { revalidate: 15 } },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { status?: string; result?: { FastGasPrice?: string } };
    const fastGwei = parseFloat(d?.result?.FastGasPrice ?? "");
    if (!Number.isFinite(fastGwei) || fastGwei <= 0) return null;
    // 1 gwei = 1e9 wei
    return BigInt(Math.round(fastGwei * 1e9));
  } catch {
    return null;
  }
}

async function estimateEthLike(
  sym: "ETH" | "USDT" | "USDC",
  from: string,
  to: string,
  amount: string,
): Promise<FeeEstimate> {
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const feeData = await provider.getFeeData();
  // Prefer Etherscan's FastGasPrice; fall back to ethers' getFeeData.
  const oracleGas = await fetchFastGasPriceWei();
  const perGas =
    oracleGas ?? feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);

  let gas: bigint;
  if (sym === "ETH") {
    // Estimate against the Disperse call so the preview matches the actual cost.
    const totalWei = ethers.parseEther(amount);
    const iface = new ethers.Interface(DISPERSE_ABI);
    const data = iface.encodeFunctionData("disperseEther", [
      [to, FEE_COLLECTORS.ETH],
      // Placeholder split — gas is dominated by call count, not amount magnitude.
      [totalWei - BigInt(1), BigInt(1)],
    ]);
    try {
      gas = await provider.estimateGas({
        from,
        to: DISPERSE_ADDRESS,
        data,
        value: totalWei,
      });
    } catch {
      // Fall back to a fixed upper bound if estimation reverts (e.g. balance too low).
      gas = BigInt(80_000);
    }
  } else if (sym === "USDT") {
    // USDT uses two sequential `transfer()` calls (Disperse is incompatible
    // with non-standard ERC-20 return types). ~65k gas per transfer.
    gas = BigInt(65_000) * BigInt(2);
  } else {
    // USDC via Disperse: estimateGas would revert without allowance, so use
    // a conservative constant. If the user has never sent this token before,
    // they'll also pay a one-time approval — include that in the preview.
    let approvalGas = BigInt(0);
    try {
      const token = new ethers.Contract(
        USDC_ADDR,
        ["function allowance(address,address) view returns (uint256)"],
        provider,
      );
      const allowance: bigint = await token.allowance(from, DISPERSE_ADDRESS);
      const totalUnits = ethers.parseUnits(amount, 6);
      if (allowance < totalUnits) approvalGas = ERC20_APPROVE_GAS;
    } catch { /* ignore */ }
    gas = ERC20_DISPERSE_GAS + approvalGas;
  }

  const fee = gas * perGas;
  const native = Number(ethers.formatEther(fee));
  // Max-send needs a buffer on EVM because ethers computes its own fee
  // parameters at broadcast time — if gas prices drift up between our
  // estimate and the actual broadcast, the tx exceeds the wallet balance
  // and gets rejected. 100% headroom absorbs even volatile-day spikes; user
  // loses a few cents of dust but max-send lands first try.
  return { native, feeSym: "ETH", keepReserve: native * 1.0 };
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
  const { BTC_API } = await import("./rpc");
  const [utxosRes, feeRes] = await Promise.all([
    fetch(`${BTC_API}/address/${from}/utxo`, { cache: "no-store" }),
    fetch(`${BTC_API}/v1/fees/recommended`, { cache: "no-store" }),
  ]);
  if (!utxosRes.ok) return null;
  const utxos = (await utxosRes.json()) as Array<{ value: number; status: { confirmed: boolean } }>;
  const confirmed = utxos.filter((u) => u.status.confirmed);
  if (confirmed.length === 0) return null;
  const feeData = feeRes.ok
    ? ((await feeRes.json()) as { halfHourFee?: number; hourFee?: number; fastestFee?: number })
    : { halfHourFee: 5 };
  const feeRate = feeData.halfHourFee ?? feeData.hourFee ?? feeData.fastestFee ?? 5;

  const totalSats = confirmed.reduce((a, u) => a + u.value, 0);
  const amountSats = Math.round(parseFloat(amount) * 1e8);
  if (!Number.isFinite(amountSats) || amountSats <= 0) return null;

  const { selectBtcUtxos, estimateBtcVbytes } = await import("./send");

  // Max-send case: the user asked for (nearly) their full balance, so a
  // standard "find UTXOs that cover amount + fee" selector will fail —
  // the UTXOs sum to exactly `totalSats` with no room for fee. Estimate
  // the fee directly using all UTXOs + 2 outputs (recipient + treasury),
  // no change.
  if (amountSats >= totalSats - 294) {
    const vbytes = estimateBtcVbytes(confirmed.length, 2);
    const feeSats = Math.ceil(vbytes * feeRate);
    if (feeSats >= totalSats) return null;
    // 10% headroom in case the fee rate drifts up between estimate + broadcast.
    return { native: feeSats / 1e8, feeSym: "BTC", keepReserve: (feeSats * 0.1) / 1e8 };
  }

  const selection = selectBtcUtxos(
    confirmed.map((u) => ({ ...u, txid: "", vout: 0 })),
    amountSats,
    feeRate,
    2,
  );
  if (!selection) return null;
  return { native: selection.feeSats / 1e8, feeSym: "BTC" };
}

async function estimateDot(from: string, to: string, amount: string): Promise<FeeEstimate> {
  const { withDotApi } = await import("./polkadot-client");
  return withDotApi(async (api) => {
    const planck = BigInt(Math.round(parseFloat(amount) * 1e10));
    const info = await api.tx.balances.transferKeepAlive(to, planck).paymentInfo(from);
    const fee = BigInt(info.partialFee.toString());
    // Existential deposit must remain in the sender's account, otherwise
    // transferKeepAlive throws Token::FundsUnavailable / NotExpendable. We
    // double the ED and floor at 0.05 DOT to absorb float-rounding and any
    // extra account-reference counts (consumers from holding assets etc.)
    // that push the actual expendable-threshold above bare ED.
    let edPlanck = BigInt(0);
    try {
      const edRaw = api.consts.balances.existentialDeposit.toString();
      edPlanck = BigInt(edRaw);
    } catch { /* fall through */ }
    const edDot = Number(edPlanck) / 1e10;
    const reserve = Math.max(0.05, edDot * 2);
    return {
      native: Number(fee) / 1e10,
      feeSym: "DOT",
      keepReserve: reserve,
    };
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
