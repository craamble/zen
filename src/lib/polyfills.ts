// Browser polyfill for Buffer — needed by bitcoinjs-lib, @solana/web3.js, bs58check.
"use client";
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  const g = window as unknown as { Buffer?: typeof Buffer; global?: unknown };
  if (!g.Buffer) g.Buffer = Buffer;
  if (!g.global) g.global = window;
}

export {};
