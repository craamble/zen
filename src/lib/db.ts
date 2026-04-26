import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "zenwallet.db");

let _db: Database.Database | null = null;

export function db() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dot_address TEXT,
      eth_address TEXT,
      btc_address TEXT,
      sol_address TEXT,
      mnemonic TEXT,
      text1_label TEXT DEFAULT '24h Change',
      text2_label TEXT DEFAULT '7d Change',
      text3_value TEXT DEFAULT '—',
      text4_value TEXT DEFAULT '—',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT,
      balance TEXT NOT NULL,
      logo TEXT,
      price TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  try {
    _db.exec(`ALTER TABLE accounts ADD COLUMN mnemonic TEXT`);
  } catch { /* already present */ }
  try {
    _db.exec(`ALTER TABLE custom_tokens ADD COLUMN price TEXT`);
  } catch { /* already present */ }
  // Seed default admin if missing. Default password: "admin" (change in settings).
  const row = _db.prepare("SELECT COUNT(*) as c FROM admin").get() as { c: number };
  if (row.c === 0) {
    // Stored as SHA-256 of "admin" — admin changes it via API later
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update("admin").digest("hex");
    _db.prepare("INSERT INTO admin (id, password_hash) VALUES (1, ?)").run(hash);
  }
  return _db;
}

export type NotificationRow = {
  id: string;
  account_id: string | null;
  title: string;
  body: string;
  created_at: number;
};

export type CustomTokenRow = {
  id: string;
  account_id: string;
  name: string;
  symbol: string | null;
  balance: string;
  logo: string | null;
  price: string | null;
  created_at: number;
};

export type AccountRow = {
  id: string;
  name: string;
  dot_address: string | null;
  eth_address: string | null;
  btc_address: string | null;
  sol_address: string | null;
  mnemonic: string | null;
  text1_label: string;
  text2_label: string;
  text3_value: string;
  text4_value: string;
  created_at: number;
};
