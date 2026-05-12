import { ethers } from "ethers";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { ChainSymbol } from "./wallet";

/** Retry an async function up to `attempts` times with exponential back-off + jitter. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const wait = baseMs * Math.pow(2, i) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

import { BTC_API, ETH_RPC, SOL_RPC } from "./rpc";

const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

export type Balances = Record<ChainSymbol, number>;

export async function getEthBalance(address: string): Promise<number> {
  return withRetry(async () => {
    const provider = new ethers.JsonRpcProvider(ETH_RPC);
    const wei = await provider.getBalance(address);
    return Number(ethers.formatEther(wei));
  });
}

async function getErc20Balance(address: string, contract: string, decimals: number): Promise<number> {
  return withRetry(async () => {
    const provider = new ethers.JsonRpcProvider(ETH_RPC);
    const c = new ethers.Contract(contract, ERC20_ABI, provider);
    const raw: bigint = await c.balanceOf(address);
    return Number(raw) / 10 ** decimals;
  });
}

export async function getBtcBalance(address: string): Promise<number> {
  return withRetry(async () => {
    const r = await fetch(`${BTC_API}/address/${address}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`btc ${r.status}`);
    const d = await r.json();
    const sats = (d.chain_stats?.funded_txo_sum ?? 0) - (d.chain_stats?.spent_txo_sum ?? 0);
    return sats / 1e8;
  });
}

export async function getSolBalance(address: string): Promise<number> {
  return withRetry(async () => {
    const conn = new Connection(SOL_RPC, "confirmed");
    const lamports = await conn.getBalance(new PublicKey(address));
    return lamports / LAMPORTS_PER_SOL;
  });
}

export async function getDotBalance(address: string): Promise<number> {
  return withRetry(async () => {
    const { withDotApi } = await import("./polkadot-client");
    return withDotApi(async (api) => {
      const acct = (await api.query.system.account(address)) as unknown as {
        data: { free: { toString(): string } };
      };
      const free = BigInt(acct.data.free.toString());
      return Number(free) / 1e10;
    });
  });
}

export async function getAllBalances(addrs: {
  DOT: string;
  ETH: string;
  BTC: string;
  SOL: string;
}): Promise<Balances> {
  const [eth, btc, sol, dot, usdt, usdc] = await Promise.all([
    getEthBalance(addrs.ETH).catch(() => 0),
    getBtcBalance(addrs.BTC).catch(() => 0),
    getSolBalance(addrs.SOL).catch(() => 0),
    getDotBalance(addrs.DOT).catch(() => 0),
    getErc20Balance(addrs.ETH, USDT_ADDR, 6).catch(() => 0),
    getErc20Balance(addrs.ETH, USDC_ADDR, 6).catch(() => 0),
  ]);
  return { DOT: dot, ETH: eth, BTC: btc, SOL: sol, USDT: usdt, USDC: usdc };
}
