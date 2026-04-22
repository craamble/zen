import { ethers } from "ethers";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { deriveEth, deriveSol, deriveDot } from "./wallet";
import type { ChainSymbol } from "./wallet";

const ETH_RPC = "https://cloudflare-eth.com";
const SOL_RPC = "https://api.mainnet-beta.solana.com";
const DOT_WS = "wss://rpc.polkadot.io";

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
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new PublicKey(to),
      lamports: Math.round(parseFloat(amount) * LAMPORTS_PER_SOL),
    }),
  );
  const sig = await sendAndConfirmTransaction(conn, tx, [kp]);
  return sig;
}

export async function sendDot(mnemonic: string, to: string, amount: string): Promise<string> {
  const { ApiPromise, WsProvider } = await import("@polkadot/api");
  const { Keyring } = await import("@polkadot/keyring");
  const { cryptoWaitReady } = await import("@polkadot/util-crypto");
  await cryptoWaitReady();
  const provider = new WsProvider(DOT_WS);
  const api = await ApiPromise.create({ provider });
  const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
  const pair = keyring.addFromMnemonic(mnemonic);
  const planck = BigInt(Math.round(parseFloat(amount) * 1e10));
  const hash = await api.tx.balances.transferKeepAlive(to, planck).signAndSend(pair);
  await api.disconnect();
  return hash.toHex();
}

export async function sendBtc(): Promise<string> {
  // BTC sends need UTXO management + signing with tiny-secp256k1.
  // To ship this safely, use a trusted wallet (e.g. Electrum, Sparrow) with the exported WIF.
  throw new Error(
    "BTC sending is disabled in-app. Import the private key (WIF) into Electrum/Sparrow for safety.",
  );
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
      return sendBtc();
  }
}
