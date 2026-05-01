import crypto from "crypto";
import type { AccountRow, NotificationRow, CustomTokenRow } from "./db";

export type { AccountRow, NotificationRow, CustomTokenRow };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

function defaultAdminHash(): string {
  return crypto.createHash("sha256").update("admin").digest("hex");
}

let _client: ReturnType<typeof buildClient> | null = null;
function buildClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env not set");
  // Lazy require to avoid bundling when unused (e.g. local SQLite path).
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function sb() {
  if (!_client) _client = buildClient();
  return _client;
}

export async function listAccounts(): Promise<AccountRow[]> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AccountRow[];
  }
  const { db } = await import("./db");
  return db()
    .prepare("SELECT * FROM accounts ORDER BY created_at DESC")
    .all() as AccountRow[];
}

export async function getAccount(id: string): Promise<AccountRow | null> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as AccountRow | null) ?? null;
  }
  const { db } = await import("./db");
  const row = db()
    .prepare("SELECT * FROM accounts WHERE id = ?")
    .get(id) as AccountRow | undefined;
  return row ?? null;
}

export async function insertAccount(row: AccountRow): Promise<void> {
  if (useSupabase) {
    const { error } = await sb().from("accounts").insert(row);
    if (error) throw error;
    return;
  }
  const { db } = await import("./db");
  db()
    .prepare(
      `INSERT INTO accounts
        (id, name, dot_address, eth_address, btc_address, sol_address, mnemonic,
         text1_label, text2_label, text3_value, text4_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.name,
      row.dot_address,
      row.eth_address,
      row.btc_address,
      row.sol_address,
      row.mnemonic,
      row.text1_label,
      row.text2_label,
      row.text3_value,
      row.text4_value,
      row.created_at,
    );
}

export async function patchAccount(
  id: string,
  patch: Partial<Pick<AccountRow, "text1_label" | "text2_label" | "text3_value" | "text4_value">>,
): Promise<boolean> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("accounts")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
  const { db } = await import("./db");
  const fields: string[] = [];
  const values: (string | number)[] = [];
  for (const key of ["text1_label", "text2_label", "text3_value", "text4_value"] as const) {
    const v = patch[key];
    if (typeof v === "string") {
      fields.push(`${key} = ?`);
      values.push(v);
    }
  }
  if (!fields.length) return false;
  values.push(id);
  const info = db()
    .prepare(`UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return info.changes > 0;
}

export async function deleteAccount(id: string): Promise<void> {
  if (useSupabase) {
    const { error } = await sb().from("accounts").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const { db } = await import("./db");
  db().prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

export async function listNotificationsFor(accountId: string): Promise<NotificationRow[]> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("notifications")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as NotificationRow[];
  }
  const { db } = await import("./db");
  return db()
    .prepare(
      `SELECT * FROM notifications
       WHERE account_id = ?
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(accountId) as NotificationRow[];
}

export async function insertNotification(row: NotificationRow): Promise<void> {
  if (useSupabase) {
    const { error } = await sb().from("notifications").insert(row);
    if (error) throw error;
    return;
  }
  const { db } = await import("./db");
  db()
    .prepare(
      `INSERT INTO notifications (id, account_id, title, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.account_id, row.title, row.body, row.created_at);
}

export async function listCustomTokensFor(accountId: string): Promise<CustomTokenRow[]> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("custom_tokens")
      .select("*")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CustomTokenRow[];
  }
  const { db } = await import("./db");
  return db()
    .prepare("SELECT * FROM custom_tokens WHERE account_id = ? AND deleted_at IS NULL ORDER BY created_at ASC")
    .all(accountId) as CustomTokenRow[];
}

export async function listAllCustomTokensFor(accountId: string): Promise<CustomTokenRow[]> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("custom_tokens")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CustomTokenRow[];
  }
  const { db } = await import("./db");
  return db()
    .prepare("SELECT * FROM custom_tokens WHERE account_id = ? ORDER BY created_at ASC")
    .all(accountId) as CustomTokenRow[];
}

export async function insertCustomToken(row: CustomTokenRow): Promise<void> {
  if (useSupabase) {
    const { error } = await sb().from("custom_tokens").insert(row);
    if (error) throw error;
    return;
  }
  const { db } = await import("./db");
  db()
    .prepare(
      `INSERT INTO custom_tokens (id, account_id, name, symbol, balance, logo, price, deleted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.account_id, row.name, row.symbol, row.balance, row.logo, row.price, row.deleted_at, row.created_at);
}

export async function deleteCustomToken(id: string): Promise<void> {
  const ts = Date.now();
  if (useSupabase) {
    const { error } = await sb().from("custom_tokens").update({ deleted_at: ts }).eq("id", id);
    if (error) throw error;
    return;
  }
  const { db } = await import("./db");
  db().prepare("UPDATE custom_tokens SET deleted_at = ? WHERE id = ?").run(ts, id);
}

export async function getAdminHash(): Promise<string> {
  if (useSupabase) {
    const { data, error } = await sb()
      .from("admin")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (data?.password_hash) return data.password_hash;
    const seed = defaultAdminHash();
    await sb().from("admin").upsert({ id: 1, password_hash: seed });
    return seed;
  }
  const { db } = await import("./db");
  const row = db()
    .prepare("SELECT password_hash FROM admin WHERE id = 1")
    .get() as { password_hash: string } | undefined;
  return row?.password_hash ?? defaultAdminHash();
}
