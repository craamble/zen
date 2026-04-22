import { generateMnemonic as gen, validateMnemonic as val, mnemonicToSeed as m2s } from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english.js";

export const wordlist = english;

export function generateMnemonic(): string {
  return gen(english, 128); // 12 words
}

export function validateMnemonic(m: string): boolean {
  return val(m, english);
}

export function mnemonicToSeed(m: string): Promise<Uint8Array> {
  return m2s(m);
}
