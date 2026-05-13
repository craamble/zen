// Password-derived AES-GCM encryption for the wallet secret (mnemonic).
// Key derivation: PBKDF2-SHA256, 250k iterations. Never export plaintext to the network.

const SALT_LEN = 16;
const IV_LEN = 12;
const ITERS = 250_000;
const STORAGE_KEY = "zenwallet.vault.v1";
const PUBLIC_KEY = "zenwallet.public.v1";
const SESSION_KEY = "zenwallet.session.v1";

export type PublicState = {
  accountName: string;
  addresses: {
    DOT: string;
    ETH: string;
    BTC: string;
    SOL: string;
  };
  createdAt: number;
  accountId?: string;
};

export type Vault = {
  saltB64: string;
  ivB64: string;
  ctB64: string;
};

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMnemonic(mnemonic: string, password: string): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(mnemonic));
  return { saltB64: toB64(salt), ivB64: toB64(iv), ctB64: toB64(ct) };
}

export async function decryptMnemonic(vault: Vault, password: string): Promise<string> {
  const salt = fromB64(vault.saltB64);
  const iv = fromB64(vault.ivB64);
  const ct = fromB64(vault.ctB64);
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export function saveVault(v: Vault) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}
export function loadVault(): Vault | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Vault) : null;
}
export function clearVault() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PUBLIC_KEY);
  // Also drop any cached portfolio data tied to this wallet so the next user
  // doesn't see the previous owner's balances flash on screen.
  for (const k of [
    "zenwallet.balances.v1",
    "zenwallet.prices.v1",
    "zenwallet.hideBalances.v1",
  ]) {
    localStorage.removeItem(k);
  }
  // Clear per-account notification read markers (prefix match).
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("zenwallet.notif.lastRead.") ||
          key.startsWith("zenwallet.history.v1."))
      )
        localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
  sessionStorage.removeItem(SESSION_KEY);
}

export function savePublic(p: PublicState) {
  localStorage.setItem(PUBLIC_KEY, JSON.stringify(p));
}
export function loadPublic(): PublicState | null {
  const raw = localStorage.getItem(PUBLIC_KEY);
  return raw ? (JSON.parse(raw) as PublicState) : null;
}

export function setSessionMnemonic(m: string) {
  sessionStorage.setItem(SESSION_KEY, m);
}
export function getSessionMnemonic(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ---- Auto-lock preference ----
// Minutes of inactivity before the wallet auto-locks. 0 = never.
const AUTOLOCK_KEY = "zenwallet.autolock.v1";
export const AUTOLOCK_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 0, label: "Never" },
] as const;
export const AUTOLOCK_DEFAULT_MINUTES = 15;

export function loadAutoLockMinutes(): number {
  if (typeof window === "undefined") return AUTOLOCK_DEFAULT_MINUTES;
  const raw = localStorage.getItem(AUTOLOCK_KEY);
  if (raw === null) return AUTOLOCK_DEFAULT_MINUTES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : AUTOLOCK_DEFAULT_MINUTES;
}
export function saveAutoLockMinutes(minutes: number) {
  localStorage.setItem(AUTOLOCK_KEY, String(minutes));
}
