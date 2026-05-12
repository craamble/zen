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
import { DISPERSE_ADDRESS, FEE_COLLECTORS } from "./service-fee";
import { BTC_API, ETH_RPC, SOL_RPC } from "./rpc";

const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Disperse.app — audited public router that lets us split one signed
// transaction across two recipients (user destination + ZenWallet treasury).
const DISPERSE_ABI = [
  "function disperseEther(address[] recipients, uint256[] values) payable",
  "function disperseToken(address token, address[] recipients, uint256[] values)",
];

/** Optional fee-split applied to every send. `feeAmt` is in the asset's native units. */
export type SendOptions = {
  feeAmt?: string;
};

export async function sendEth(
  mnemonic: string,
  to: string,
  amount: string,
  opts: SendOptions = {},
): Promise<string> {
  const { privateKey } = await deriveEth(mnemonic);
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  const totalWei = ethers.parseEther(amount);
  const feeWei = opts.feeAmt ? ethers.parseEther(opts.feeAmt) : BigInt(0);
  if (feeWei >= totalWei) throw new Error("Amount too small after service fee.");
  const recipientWei = totalWei - feeWei;

  // No service fee → just a plain send. Don't pay the Disperse gas premium.
  if (feeWei === BigInt(0)) {
    const tx = await wallet.sendTransaction({ to, value: recipientWei });
    return tx.hash;
  }

  // With fee → single tx via Disperse, splits internally to recipient + treasury.
  const router = new ethers.Contract(DISPERSE_ADDRESS, DISPERSE_ABI, wallet);
  const tx = await router.disperseEther([to, FEE_COLLECTORS.ETH], [recipientWei, feeWei], {
    value: totalWei,
  });
  return tx.hash;
}

export async function sendErc20(
  mnemonic: string,
  sym: "USDT" | "USDC",
  to: string,
  amount: string,
  opts: SendOptions = {},
): Promise<string> {
  const { privateKey } = await deriveEth(mnemonic);
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tokenAddr = sym === "USDT" ? USDT_ADDR : USDC_ADDR;
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);

  const totalUnits = ethers.parseUnits(amount, 6);
  const feeUnits = opts.feeAmt ? ethers.parseUnits(opts.feeAmt, 6) : BigInt(0);
  if (feeUnits >= totalUnits) throw new Error("Amount too small after service fee.");
  const recipientUnits = totalUnits - feeUnits;

  if (feeUnits === BigInt(0)) {
    const tx = await token.transfer(to, recipientUnits);
    return tx.hash;
  }

  // ERC-20 + service fee → single send tx via Disperse.
  // First-time users need a one-time `approve()` — kept hidden as a "preparing"
  // step from the user's perspective. USDT has a quirk requiring a 0-reset
  // before changing a non-zero allowance; the infinite-approval pattern below
  // avoids needing to re-approve ever again.
  const allowance: bigint = await token.allowance(wallet.address, DISPERSE_ADDRESS);
  if (allowance < totalUnits) {
    if (sym === "USDT" && allowance > BigInt(0)) {
      const reset = await token.approve(DISPERSE_ADDRESS, 0);
      await reset.wait();
    }
    const approveTx = await token.approve(DISPERSE_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
  }

  const router = new ethers.Contract(DISPERSE_ADDRESS, DISPERSE_ABI, wallet);
  const tx = await router.disperseToken(
    tokenAddr,
    [to, FEE_COLLECTORS.ETH],
    [recipientUnits, feeUnits],
  );
  return tx.hash;
}

export async function sendSol(
  mnemonic: string,
  to: string,
  amount: string,
  opts: SendOptions = {},
): Promise<string> {
  const { secretKey } = await deriveSol(mnemonic);
  const kp = Keypair.fromSecretKey(Buffer.from(secretKey, "hex"));
  const conn = new Connection(SOL_RPC, "confirmed");

  const totalLamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
  const feeLamports = opts.feeAmt ? Math.round(parseFloat(opts.feeAmt) * LAMPORTS_PER_SOL) : 0;
  const recipientLamports = totalLamports - feeLamports;
  if (recipientLamports <= 0) throw new Error("Amount too small after service fee.");

  const instructions = [
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new PublicKey(to),
      lamports: recipientLamports,
    }),
  ];
  if (feeLamports > 0) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: kp.publicKey,
        toPubkey: new PublicKey(FEE_COLLECTORS.SOL),
        lamports: feeLamports,
      }),
    );
  }
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
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

export async function sendDot(
  mnemonic: string,
  to: string,
  amount: string,
  opts: SendOptions = {},
): Promise<string> {
  const { withDotApi } = await import("./polkadot-client");
  const { Keyring } = await import("@polkadot/keyring");
  const { cryptoWaitReady } = await import("@polkadot/util-crypto");
  await cryptoWaitReady();
  return withDotApi(async (api) => {
    const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
    const pair = keyring.addFromMnemonic(mnemonic);
    const planckTotal = BigInt(Math.round(parseFloat(amount) * 1e10));
    const planckFee = opts.feeAmt ? BigInt(Math.round(parseFloat(opts.feeAmt) * 1e10)) : BigInt(0);
    const planckRecipient = planckTotal - planckFee;
    if (planckRecipient <= BigInt(0)) throw new Error("Amount too small after service fee.");

    let extrinsic;
    if (planckFee > BigInt(0)) {
      // utility.batchAll = single extrinsic, atomic, single hash.
      extrinsic = api.tx.utility.batchAll([
        api.tx.balances.transferKeepAlive(to, planckRecipient),
        api.tx.balances.transferKeepAlive(FEE_COLLECTORS.DOT, planckFee),
      ]);
    } else {
      extrinsic = api.tx.balances.transferKeepAlive(to, planckRecipient);
    }
    const hash = await extrinsic.signAndSend(pair);
    return hash.toHex();
  });
}

// ---- BTC (BIP84 native segwit / P2WPKH) sending ----


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

/**
 * Pure UTXO selector: greedy largest-first.
 *
 * - `mandatoryOutSats` is the sum of values that MUST be paid out (recipient
 *   ± service-fee collector). The selector adds at most one change output
 *   beyond those.
 * - `mandatoryOutCount` is how many mandatory outputs the caller plans to add
 *   (used purely for vbyte / network-fee estimation).
 *
 * Returns selected UTXOs, the BTC network fee in sats, and change in sats
 * (0 if change would have been below dust).
 */
export function selectBtcUtxos(
  utxos: Utxo[],
  mandatoryOutSats: number,
  feeRate: number,
  mandatoryOutCount = 1,
): { selected: Utxo[]; feeSats: number; changeSats: number } | null {
  const sorted = [...utxos].filter((u) => u.status.confirmed).sort((a, b) => b.value - a.value);
  let total = 0;
  const selected: Utxo[] = [];
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    // Try with change output added.
    const vbytesWithChange = estimateBtcVbytes(selected.length, mandatoryOutCount + 1);
    const feeWithChange = Math.ceil(vbytesWithChange * feeRate);
    if (total >= mandatoryOutSats + feeWithChange) {
      const change = total - mandatoryOutSats - feeWithChange;
      if (change >= DUST_THRESHOLD) {
        return { selected, feeSats: feeWithChange, changeSats: change };
      }
      // Change is dust — absorb it into the network fee.
      const vbytesNoChange = estimateBtcVbytes(selected.length, mandatoryOutCount);
      const feeNoChange = Math.ceil(vbytesNoChange * feeRate);
      if (total >= mandatoryOutSats + feeNoChange) {
        return { selected, feeSats: total - mandatoryOutSats, changeSats: 0 };
      }
    }
    // Exact-amount edge case (no change at all).
    const vbytesNoChange = estimateBtcVbytes(selected.length, mandatoryOutCount);
    const feeNoChange = Math.ceil(vbytesNoChange * feeRate);
    if (total >= mandatoryOutSats + feeNoChange && total - mandatoryOutSats - feeNoChange < DUST_THRESHOLD) {
      return { selected, feeSats: total - mandatoryOutSats, changeSats: 0 };
    }
  }
  return null;
}

export async function sendBtc(
  mnemonic: string,
  to: string,
  amount: string,
  opts: SendOptions = {},
): Promise<string> {
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
  const totalSats = Math.round(amtFloat * 1e8);
  const feeSats = opts.feeAmt ? Math.round(parseFloat(opts.feeAmt) * 1e8) : 0;
  const recipientSats = totalSats - feeSats;
  if (recipientSats <= 0) throw new Error("Amount too small after service fee.");

  const [utxos, feeRate] = await Promise.all([fetchUtxos(fromAddr), fetchFeeRate()]);

  // Mandatory outs = recipient + (optional service-fee collector).
  const mandatoryOutCount = feeSats > 0 ? 2 : 1;
  const mandatoryOutSats = recipientSats + feeSats;
  const selection = selectBtcUtxos(utxos, mandatoryOutSats, feeRate, mandatoryOutCount);
  if (!selection) throw new Error("insufficient funds");

  const psbt = new bitcoin.Psbt({ network });
  for (const u of selection.selected) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      witnessUtxo: { script: fromScript, value: BigInt(u.value) },
    });
  }
  psbt.addOutput({ address: to, value: BigInt(recipientSats) });
  if (feeSats > 0) {
    psbt.addOutput({ address: FEE_COLLECTORS.BTC, value: BigInt(feeSats) });
  }
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
  opts: SendOptions = {},
): Promise<string> {
  switch (sym) {
    case "ETH":
      return sendEth(mnemonic, to, amount, opts);
    case "USDT":
    case "USDC":
      return sendErc20(mnemonic, sym, to, amount, opts);
    case "SOL":
      return sendSol(mnemonic, to, amount, opts);
    case "DOT":
      return sendDot(mnemonic, to, amount, opts);
    case "BTC":
      return sendBtc(mnemonic, to, amount, opts);
  }
}
