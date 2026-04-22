import { HDKey } from "@scure/bip32";
import { mnemonicToSeed, generateMnemonic, validateMnemonic } from "./bip39-compat";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import * as bitcoin from "bitcoinjs-lib";
import bs58check from "bs58check";
import { Buffer } from "buffer";

export type ChainSymbol = "DOT" | "ETH" | "BTC" | "SOL" | "USDT" | "USDC";

export type DerivedWallet = {
  mnemonic: string;
  eth: { address: string; privateKey: string };
  btc: { address: string; wif: string };
  sol: { address: string; secretKey: string };
  dot: { address: string; mnemonic: string };
};

export function newMnemonic(): string {
  return generateMnemonic();
}

export function isValidMnemonic(m: string): boolean {
  return validateMnemonic(m.trim().toLowerCase());
}

async function seedFromMnemonic(mnemonic: string): Promise<Uint8Array> {
  return mnemonicToSeed(mnemonic);
}

export async function deriveEth(mnemonic: string) {
  const w = ethers.HDNodeWallet.fromPhrase(mnemonic);
  return { address: w.address, privateKey: w.privateKey };
}

export async function deriveBtc(mnemonic: string) {
  const seed = await seedFromMnemonic(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  // BIP84 native segwit: m/84'/0'/0'/0/0
  const child = root.derive("m/84'/0'/0'/0/0");
  if (!child.publicKey || !child.privateKey) throw new Error("BTC derive failed");
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  if (!address) throw new Error("BTC address failed");
  // Export WIF manually (mainnet: 0x80 prefix + privKey + 0x01 compressed flag + checksum)
  const wif = privateKeyToWIF(child.privateKey);
  return { address, wif };
}

function privateKeyToWIF(privKey: Uint8Array): string {
  const payload = new Uint8Array(1 + 32 + 1);
  payload[0] = 0x80;
  payload.set(privKey, 1);
  payload[33] = 0x01;
  return bs58check.encode(Buffer.from(payload));
}

export async function deriveSol(mnemonic: string) {
  const seed = await seedFromMnemonic(mnemonic);
  const seedBuf = Buffer.from(seed).toString("hex");
  const { key } = derivePath("m/44'/501'/0'/0'", seedBuf);
  const kp = Keypair.fromSeed(key);
  return {
    address: kp.publicKey.toBase58(),
    secretKey: Buffer.from(kp.secretKey).toString("hex"),
  };
}

export async function deriveDot(mnemonic: string) {
  const { Keyring } = await import("@polkadot/keyring");
  const { cryptoWaitReady } = await import("@polkadot/util-crypto");
  await cryptoWaitReady();
  const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
  const pair = keyring.addFromMnemonic(mnemonic);
  return { address: pair.address, mnemonic };
}

export async function deriveAll(mnemonic: string): Promise<DerivedWallet> {
  const [eth, btc, sol, dot] = await Promise.all([
    deriveEth(mnemonic),
    deriveBtc(mnemonic),
    deriveSol(mnemonic),
    deriveDot(mnemonic),
  ]);
  return { mnemonic, eth, btc, sol, dot };
}
