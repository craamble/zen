"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type CustomToken = {
  id: string;
  account_id: string;
  name: string;
  symbol: string | null;
  balance: string;
  logo: string | null;
  price: string | null;
  deleted_at: number | null;
  created_at: number;
};

const ICON_OPTIONS: { sym: string; src: string }[] = [
  { sym: "BTC", src: "/tokens/1.gif" },
  { sym: "ETH", src: "/tokens/1027.png" },
  { sym: "USDT", src: "/tokens/825.png" },
  { sym: "USDC", src: "/tokens/3408.png" },
  { sym: "SOL", src: "/tokens/5426.gif" },
  { sym: "DOT", src: "/tokens/6636.png" },
];

const TICKER_OPTIONS: { ticker: string; label: string; sym: string }[] = [
  { ticker: "bitcoin", label: "bitcoin", sym: "BTC" },
  { ticker: "ethereum", label: "ethereum", sym: "ETH" },
  { ticker: "tether", label: "tether", sym: "USDT" },
  { ticker: "usd-coin", label: "usd-coin", sym: "USDC" },
  { ticker: "solana", label: "solana", sym: "SOL" },
  { ticker: "polkadot", label: "polkadot", sym: "DOT" },
];

function TokensEditor({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<CustomToken[] | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState("");
  const [price, setPrice] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function load() {
    const r = await fetch(`/api/admin/tokens?accountId=${encodeURIComponent(accountId)}`);
    if (r.ok) setTokens((await r.json()).tokens);
  }

  useEffect(() => {
    if (open && tokens === null) load();
  }, [open]);

  async function addToken() {
    if (!name.trim() || !balance.trim()) return;
    if (!/^-?\d+(\.\d+)?$/.test(balance.trim())) {
      toast.show("Balance must be a number");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          name: name.trim(),
          symbol: symbol.trim(),
          balance: balance.trim(),
          price: price.trim(),
          logo,
        }),
      });
      if (r.ok) {
        toast.show("Token added");
        setName(""); setSymbol(""); setBalance(""); setPrice(""); setLogo(null);
        await load();
      } else {
        const e = await r.json().catch(() => ({}));
        toast.show(e?.error === "bad_price" ? "Invalid price" : "Add failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeToken(id: string) {
    if (!confirm("Remove this token?")) return;
    const r = await fetch(`/api/admin/tokens/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.show("Removed");
      await load();
    }
  }

  return (
    <details className="mt-2" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="muted text-xs cursor-pointer">custom tokens{tokens ? ` (${tokens.length})` : ""}</summary>
      <div className="mt-2 flex flex-col gap-2 p-2 rounded-md border border-[var(--border)] bg-[var(--bg-2)]/40">
        {tokens === null && open && <div className="flex justify-center p-2"><span className="spinner" /></div>}
        {tokens && tokens.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                {(() => {
                  const opt = t.logo ? ICON_OPTIONS.find((o) => o.sym === t.logo!.toUpperCase()) : null;
                  if (opt) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.src} alt="" className="w-5 h-5 rounded-full object-cover" />
                    );
                  }
                  return <span className="w-5 h-5 rounded-full bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center text-[9px]">{(t.symbol || t.name || "?")[0]?.toUpperCase()}</span>;
                })()}
                <span className="font-medium">{t.name}</span>
                {t.symbol && <span className="muted">{t.symbol}</span>}
                {t.price && (
                  <span className="muted text-[10px]">
                    @ {/^-?\d+(\.\d+)?$/.test(t.price) ? `$${t.price}` : t.price}
                  </span>
                )}
                <span className="ml-auto tabular-nums">{t.balance}</span>
                <button
                  className="btn btn-ghost !py-0.5 !px-2 !text-[11px]"
                  style={{ color: "var(--danger)" }}
                  onClick={() => removeToken(t.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-3 pt-1 border-t border-[var(--border)]">
          <div className="grid grid-cols-2 gap-1.5">
            <input
              className="input text-xs !py-1"
              placeholder="Name (e.g. Dogecoin)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input text-xs !py-1"
              placeholder="Symbol (e.g. DOGE)"
              value={symbol}
              onChange={(e) => {
                const v = e.target.value;
                setSymbol(v);
                const up = v.trim().toUpperCase();
                if (!logo && ICON_OPTIONS.find((o) => o.sym === up)) {
                  setLogo(up);
                }
              }}
            />
            <input
              className="input text-xs !py-1"
              placeholder="Balance (e.g. 12.5)"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            <input
              className="input text-xs !py-1"
              placeholder="Price: USD or ticker"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <div className="col-span-2 flex items-center gap-2 flex-wrap">
              <span className="muted text-[11px] mr-1">Icon:</span>
              {ICON_OPTIONS.map((o) => (
                <button
                  key={o.sym}
                  type="button"
                  onClick={() => setLogo(logo === o.sym ? null : o.sym)}
                  className={`p-0.5 rounded-full border transition ${
                    logo === o.sym ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40" : "border-transparent hover:border-[var(--border)]"
                  }`}
                  title={o.sym}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.src} alt={o.sym} className="w-6 h-6 rounded-full object-cover" />
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary !py-1 text-xs col-span-2"
              disabled={!name.trim() || !balance.trim() || saving}
              onClick={addToken}
            >
              {saving && <span className="spinner" />} Add token
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="muted text-[10px] uppercase tracking-wider">Tickers</span>
            <div className="grid grid-cols-2 gap-1 content-start">
              {TICKER_OPTIONS.map((o) => {
                const active = price.trim().toLowerCase() === o.ticker;
                return (
                  <button
                    key={o.ticker}
                    type="button"
                    onClick={() => {
                      setPrice(o.ticker);
                      if (!logo) setLogo(o.sym);
                    }}
                    className={`px-2 py-1 rounded-md border text-[11px] text-left whitespace-nowrap transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--fg-0)]"
                        : "border-[var(--border)] hover:bg-[var(--bg-2)]/60"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

type Account = {
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

export default function AdminHome() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Account>>({});
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifTarget, setNotifTarget] = useState<string>(""); // "" = all
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function sendNotification() {
    if (!notifTitle.trim() || !notifBody.trim() || !notifTarget) return;
    setSending(true);
    try {
      const r = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          accountId: notifTarget,
        }),
      });
      if (r.ok) {
        toast.show("Notification sent");
        setNotifTitle("");
        setNotifBody("");
        setNotifTarget("");
      } else {
        toast.show("Send failed");
      }
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d.isAdmin);
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    if (authed) loadAccounts();
  }, [authed]);

  async function loadAccounts() {
    const r = await fetch("/api/admin/accounts");
    if (r.ok) setAccounts((await r.json()).accounts);
  }

  async function login() {
    setLoginErr(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) {
      setAuthed(true);
      setPw("");
    } else {
      setLoginErr("Wrong password.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    router.replace("/admin");
  }

  function startEdit(a: Account) {
    setEditing(a.id);
    setDraft({
      text1_label: a.text1_label,
      text2_label: a.text2_label,
      text3_value: a.text3_value,
      text4_value: a.text4_value,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await fetch(`/api/admin/accounts/${editing}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      toast.show("Saved");
      setEditing(null);
      await loadAccounts();
    } else toast.show("Save failed");
  }

  async function deleteAcct(id: string) {
    if (!confirm("Delete this account record? (Wallet on user's device is unaffected.)")) return;
    const r = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.show("Deleted");
      await loadAccounts();
    }
  }

  if (checking) return <div className="flex justify-center p-10"><span className="spinner" /></div>;

  if (!authed) {
    return (
      <div className="flex items-center justify-center">
        <div className="card p-8 w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Admin login</h1>
          <p className="muted text-sm">
            Default password is <code className="chip">admin</code> — change the env var{" "}
            <code className="chip">ADMIN_SECRET</code> and the DB row for production.
          </p>
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            autoFocus
          />
          {loginErr && <p className="text-sm" style={{ color: "var(--danger)" }}>{loginErr}</p>}
          <button className="btn btn-primary" onClick={login}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Admin · Accounts</h1>
        <button className="btn btn-ghost" onClick={logout}>Sign out</button>
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send notification</h2>
          <select
            className="input !py-1.5 !px-3 text-sm !w-auto"
            value={notifTarget}
            onChange={(e) => setNotifTarget(e.target.value)}
          >
            <option value="">Select recipient…</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <input
          className="input"
          value={notifTitle}
          onChange={(e) => setNotifTitle(e.target.value)}
          placeholder="Title"
          maxLength={120}
        />
        <textarea
          className="input"
          rows={3}
          value={notifBody}
          onChange={(e) => setNotifBody(e.target.value)}
          placeholder="Message body"
          maxLength={1000}
        />
        <div className="flex justify-end">
          <button
            className="btn btn-primary"
            disabled={!notifTitle.trim() || !notifBody.trim() || !notifTarget || sending}
            onClick={sendNotification}
          >
            {sending && <span className="spinner" />} Send
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2.2fr_1fr_1.5fr_auto] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs label items-center">
          <span>Account name</span>
          <span className="text-center">Created</span>
          <span className="text-center">Text 1 / 3  ·  Text 2 / 4</span>
          <span className="text-center">Actions</span>
        </div>
        {accounts === null && (
          <div className="p-8 flex justify-center"><span className="spinner" /></div>
        )}
        {accounts && accounts.length === 0 && (
          <div className="p-10 text-center muted">No accounts yet.</div>
        )}
        {accounts?.map((a) => (
          <div
            key={a.id}
            className="grid grid-cols-[2.2fr_1fr_1.5fr_auto] gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0 items-start"
          >
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="muted text-xs font-mono truncate" title={a.id}>{a.id.slice(0, 8)}…</div>
              <details className="mt-2">
                <summary className="muted text-xs cursor-pointer">addresses</summary>
                <div className="mt-2 flex flex-col gap-1 text-[11px] font-mono subtle whitespace-nowrap">
                  <div>BTC: {a.btc_address}</div>
                  <div>ETH: {a.eth_address}</div>
                  <div>SOL: {a.sol_address}</div>
                  <div>DOT: {a.dot_address}</div>
                </div>
              </details>
              {a.mnemonic && (
                <details className="mt-2">
                  <summary className="muted text-xs cursor-pointer" style={{ color: "var(--danger)" }}>
                    mnemonic
                  </summary>
                  <div className="mt-2 text-[11px] font-mono break-words p-2 rounded-md border border-[var(--border)] bg-[var(--bg-2)]/40">
                    {a.mnemonic}
                  </div>
                </details>
              )}
              <TokensEditor accountId={a.id} />
            </div>
            <div className="muted text-sm text-center">{new Date(a.created_at).toLocaleString()}</div>
            <div>
              {editing === a.id ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input text-sm"
                    value={draft.text1_label ?? ""}
                    onChange={(e) => setDraft({ ...draft, text1_label: e.target.value })}
                    placeholder="Text 1 label"
                  />
                  <input
                    className="input text-sm"
                    value={draft.text2_label ?? ""}
                    onChange={(e) => setDraft({ ...draft, text2_label: e.target.value })}
                    placeholder="Text 2 label"
                  />
                  <input
                    className="input text-sm"
                    value={draft.text3_value ?? ""}
                    onChange={(e) => setDraft({ ...draft, text3_value: e.target.value })}
                    placeholder="Text 3 value (under Text 1)"
                  />
                  <input
                    className="input text-sm"
                    value={draft.text4_value ?? ""}
                    onChange={(e) => setDraft({ ...draft, text4_value: e.target.value })}
                    placeholder="Text 4 value (under Text 2)"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1 text-sm text-center">
                  <div>
                    <span className="muted">{a.text1_label}:</span> {a.text3_value}
                  </div>
                  <div>
                    <span className="muted">{a.text2_label}:</span> {a.text4_value}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {editing === a.id ? (
                <>
                  <button className="btn btn-primary !py-1.5 !px-3 text-xs" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn !py-1.5 !px-3 text-xs" onClick={() => startEdit(a)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost !py-1.5 !px-3 text-xs"
                    onClick={() => deleteAcct(a.id)}
                    style={{ color: "var(--danger)" }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
