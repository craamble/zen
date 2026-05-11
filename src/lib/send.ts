import { ethers } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as bitcoin from "bitcoinjs-lib";
import { deriveEth, deriveSol } from "./wallet";
import type { ChainSymbol } from "./wallet";

const ETH_RPC = "https://cloudflare-eth.com";
const SOL_RPC = "https://api.mainnet-beta.solana.com";

const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export async function sendEth(mnemonic: string, to: string, amount: string): Promise<string> {
  const { privateKey } = await deriveEth(mnemonic);
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(amount) });
  return tx.hash;
}

export async function sendErc20(
  mnemonic: string,
  sym: "USDT" | "USDC",
  to: string,
  amount: string,
): Promise<string> {
  const { privateKey } = await deriveEth(mnemonic);
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(sym === "USDT" ? USDT_ADDR : USDC_ADDR, ERC20_ABI, wallet);
  const decimals = sym === "USDT" ? 6 : 6;
  const tx = await contract.transfer(to, ethers.parseUnits(amount, decimals));
  return tx.hash;
}

export async function sendSol(mnemonic: string, to: string, amount: string): Promise<string> {
  const { secretKey } = await deriveSol(mnemonic);
  const kp = Keypair.fromSecretKey(Buffer.from(secretKey, "hex"));
  const conn = new Connection(SOL_RPC, "confirmed");

  const instructions = [
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new PublicKey(to),
      lamports: Math.round(parseFloat(amount) * LAMPORTS_PER_SOL),
    }),
  ];
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([kp]);

  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  // Wait for confirmation using the recent blockhash window.
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

export async function sendDot(mnemonic: string, to: string, amount: string): Promise<string> {
  const { withDotApi } = await import("./polkadot-client");
  const { Keyring } = await import("@polkadot/keyring");
  const { cryptoWaitReady } = await import("@polkadot/util-crypto");
  await cryptoWaitReady();
  return withDotApi(async (api) => {
    const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
    const pair = keyring.addFromMnemonic(mnemonic);
    const planck = BigInt(Math.round(parseFloat(amount) * 1e10));
    const hash = await api.tx.balances.transferKeepAlive(to, planck).signAndSend(pair);
    return hash.toHex();
  });
}

// ---- BTC (BIP84 native segwit / P2WPKH) sending ----

const BTC_API = "https://mempool.space/api";

type Utxo = {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
};

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const r = await fetch(`${BTC_API}/address/${address}/utxo`, { cache: "no-store" });
  if (!r.ok) throw new Error("utxo fetch failed");
  return (await r.json()) as Utxo[];
}

async function fetchFeeRate(): Promise<number> {
  // Returns sat/vB for "halfHourFee" (a sensible default).
  try {
    const r = await fetch(`${BTC_API}/v1/fees/recommended`, { cache: "no-store" });
    if (r.ok) {
      const d = (await r.json()) as { halfHourFee?: number; hourFee?: number; fastestFee?: number };
      return d.halfHourFee ?? d.hourFee ?? d.fastestFee ?? 5;
    }
  } catch { /* fall through */ }
  return 5;
}

const VBYTES_OVERHEAD = 11;
const VBYTES_PER_INPUT = 68;
const VBYTES_PER_OUTPUT = 31;
const DUST_THRESHOLD = 294; // sats — minimum for a P2WPKH output

export function estimateBtcVbytes(numInputs: number, numOutputs: number): number {
  return VBYTES_OVERHEAD + VBYTES_PER_INPUT * numInputs + VBYTES_PER_OUTPUT * numOutputs;
}

/** Pure UTXO selector: greedy largest-first. Returns selected UTXOs, fee in sats, and change in sats (0 if no change output). */
export function selectBtcUtxos(
  utxos: Utxo[],
  amountSats: number,
  feeRate: number,
): { selected: Utxo[]; feeSats: number; changeSats: number } | null {
  const sorted = [...utxos].filter((u) => u.status.confirmed).sort((a, b) => b.value - a.value);
  let total = 0;
  const selected: Utxo[] = [];
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    // Try with change output first.
    const vbytesWithChange = estimateBtcVbytes(selected.length, 2);
    const feeWithChange = Math.ceil(vbytesWithChange * feeRate);
    if (total >= amountSats + feeWithChange) {
      const change = total - amountSats - feeWithChange;
      if (change >= DUST_THRESHOLD) {
        return { selected, feeSats: feeWithChange, changeSats: change };
      }
      // Change is dust — try one-output (no change) form.
      const vbytesNoChange = estimateBtcVbytes(selected.length, 1);
      const feeNoChange = Math.ceil(vbytesNoChange * feeRate);
      if (total >= amountSats + feeNoChange) {
        return { selected, feeSats: total - amountSats, changeSats: 0 };
      }
    }
    // Also handle the no-change case for exact-amount sends.
    const vbytesNoChange = estimateBtcVbytes(selected.length, 1);
    const feeNoChange = Math.ceil(vbytesNoChange * feeRate);
    if (total >= amountSats + feeNoChange && total - amountSats - feeNoChange < DUST_THRESHOLD) {
      return { selected, feeSats: total - amountSats, changeSats: 0 };
    }
  }
  return null;
}

export async function sendBtc(mnemonic: string, to: string, amount: string): Promise<string> {
  const ecc = await import("tiny-secp256k1");
  const bs58checkMod = (await import("bs58check")) as unknown as {
    default?: { decode(s: string): Uint8Array };
    decode?: (s: string) => Uint8Array;
  };
  const bs58check = bs58checkMod.default ?? bs58checkMod;
  const { deriveBtc } = await import("./wallet");
  const { Buffer } = await import("buffer");

  const { address: fromAddr, wif } = await deriveBtc(mnemonic);

  // Decode WIF → private key.
  const decoded = bs58check.decode!(wif);
  // Mainnet WIF: [0x80][32 priv][0x01 if compressed]
  if (decoded[0] !== 0x80) throw new Error("bad wif");
  const privKey = decoded.slice(1, 33);
  const pubKey = ecc.pointFromScalar(privKey, true);
  if (!pubKey) throw new Error("pubkey derive failed");

  const network = bitcoin.networks.bitcoin;
  const fromScript = bitcoin.address.toOutputScript(fromAddr, network);

  const amtFloat = parseFloat(amount);
  if (!Number.isFinite(amtFloat) || amtFloat <= 0) throw new Error("bad amount");
  const amountSats = Math.round(amtFloat * 1e8);

  const [utxos, feeRate] = await Promise.all([fetchUtxos(fromAddr), fetchFeeRate()]);
  const selection = selectBtcUtxos(utxos, amountSats, feeRate);
  if (!selection) throw new Error("insufficient funds");

  const psbt = new bitcoin.Psbt({ network });
  for (const u of selection.selected) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      witnessUtxo: { script: fromScript, value: BigInt(u.value) },
    });
  }
  psbt.addOutput({ address: to, value: BigInt(amountSats) });
  if (selection.changeSats > 0) {
    psbt.addOutput({ address: fromAddr, value: BigInt(selection.changeSats) });
  }

  const signer = {
    publicKey: Buffer.from(pubKey),
    sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privKey)),
  };
  for (let i = 0; i < selection.selected.length; i++) {
    psbt.signInput(i, signer);
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const hex = tx.toHex();

  const r = await fetch(`${BTC_API}/tx`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: hex,
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "broadcast failed");
    throw new Error(msg || "broadcast failed");
  }
  const txid = (await r.text()).trim();
  return txid;
}

export async function send(
  mnemonic: string,
  sym: ChainSymbol,
  to: string,
  amount: string,
): Promise<string> {
  switch (sym) {
    case "ETH":
      return sendEth(mnemonic, to, amount);
    case "USDT":
    case "USDC":
      return sendErc20(mnemonic, sym, to, amount);
    case "SOL":
      return sendSol(mnemonic, to, amount);
    case "DOT":
      return sendDot(mnemonic, to, amount);
    case "BTC":
      return sendBtc(mnemonic, to, amount);
  }
}
