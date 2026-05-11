"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTOLOCK_OPTIONS,
  clearVault,
  decryptMnemonic,
  encryptMnemonic,
  loadAutoLockMinutes,
  loadPublic,
  loadVault,
  savePublic,
  saveAutoLockMinutes,
  saveVault,
  type PublicState,
} from "@/lib/vault";
import { useToast } from "@/components/Toast";

export default function Settings() {
  const [pub, setPub] = useState<PublicState | null>(null);
  const router = useRouter();
  const toast = useToast();

  // Account name editing
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Auto-lock
  const [autoLock, setAutoLock] = useState<number>(15);

  // Password change
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage on mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPub(loadPublic());
    setAutoLock(loadAutoLockMinutes());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function onChangeAutoLock(minutes: number) {
    setAutoLock(minutes);
    saveAutoLockMinutes(minutes);
    toast.show(minutes === 0 ? "Auto-lock disabled" : `Auto-lock set to ${minutes} min`);
  }

  function startEditName() {
    setNameDraft(pub?.accountName ?? "");
    setEditingName(true);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!pub || !next || next === pub.accountName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      if (pub.accountId) {
        const r = await fetch(`/api/accounts/${pub.accountId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: next }),
        });
        if (!r.ok) {
          toast.show("Save failed");
          return;
        }
      }
      const updated = { ...pub, accountName: next };
      savePublic(updated);
      setPub(updated);
      setEditingName(false);
      toast.show("Account name updated");
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setPwErr(null);
    if (!oldPw || !newPw || !confirmPw) {
      setPwErr("Fill in all fields.");
      return;
    }
    if (newPw.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr("New passwords don't match.");
      return;
    }
    const vault = loadVault();
    if (!vault) {
      setPwErr("No vault found.");
      return;
    }
    setPwBusy(true);
    try {
      let mnemonic: string;
      try {
        mnemonic = await decryptMnemonic(vault, oldPw);
      } catch {
        setPwErr("Current password is incorrect.");
        return;
      }
      const next = await encryptMnemonic(mnemonic, newPw);
      saveVault(next);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      toast.show("Password changed");
    } finally {
      setPwBusy(false);
    }
  }

  function onWipe() {
    if (!confirm("Remove wallet from this device? Make sure you have your seed phrase.")) return;
    clearVault();
    toast.show("Wallet removed");
    setTimeout(() => router.replace("/onboarding"), 500);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="muted text-sm">Account name</span>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                className="input !py-1.5 text-sm"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              <button
                className="btn btn-primary !py-1.5 !px-3 text-xs"
                onClick={saveName}
                disabled={savingName}
              >
                {savingName && <span className="spinner" />} Save
              </button>
              <button
                className="btn btn-ghost !py-1.5 !px-3 text-xs"
                onClick={() => setEditingName(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm">{pub?.accountName ?? "—"}</span>
              <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={startEditName}>
                Edit
              </button>
            </div>
          )}
        </div>
        <Row k="Created" v={pub ? new Date(pub.createdAt).toLocaleString() : "—"} />
      </div>

      <div className="glass-card p-6 flex flex-col gap-4">
        <h2 className="font-semibold">Change password</h2>
        <p className="muted text-sm">
          Re-encrypts your seed phrase with a new password. Make sure you remember it — without it
          you can only recover via your seed phrase.
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            className="input"
            placeholder="Current password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            type="password"
            className="input"
            placeholder="New password (min 8 chars)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            className="input"
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            onKeyDown={(e) => e.key === "Enter" && changePassword()}
          />
          {pwErr && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {pwErr}
            </p>
          )}
          <button
            className="btn btn-primary w-max"
            onClick={changePassword}
            disabled={pwBusy || !oldPw || !newPw || !confirmPw}
          >
            {pwBusy && <span className="spinner" />} Change password
          </button>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold">Auto-lock</h2>
            <p className="muted text-sm mt-1">
              Automatically lock the wallet after a period of inactivity.
            </p>
          </div>
          <select
            className="input !py-1.5 !px-3 text-sm !w-auto"
            value={autoLock}
            onChange={(e) => onChangeAutoLock(parseInt(e.target.value, 10))}
          >
            {AUTOLOCK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-3">
        <h2 className="font-semibold">Addresses</h2>
        {pub &&
          (["BTC", "ETH", "SOL", "DOT"] as const).map((k) => (
            <div key={k}>
              <div className="label mb-1">{k}</div>
              <code className="text-xs font-mono break-all block subtle">{pub.addresses[k]}</code>
            </div>
          ))}
      </div>

      <RevealSecrets />

      <div className="glass-card p-6 flex flex-col gap-3">
        <h2 className="font-semibold" style={{ color: "var(--danger)" }}>
          Danger zone
        </h2>
        <p className="text-sm muted">
          Removes the encrypted vault from this browser. Funds are safe as long as you have your seed
          phrase.
        </p>
        <button className="btn btn-danger w-max" onClick={onWipe}>
          Remove wallet from this device
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="muted text-sm">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

type RevealedKeys = {
  mnemonic: string;
  btcWif: string;
  ethKey: string;
  solSecret: string;
};

function RevealSecrets() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<RevealedKeys | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const toast = useToast();

  async function reveal() {
    setErr(null);
    if (!pw) {
      setErr("Enter your wallet password.");
      return;
    }
    const v = loadVault();
    if (!v) {
      setErr("No vault on this device.");
      return;
    }
    setBusy(true);
    try {
      let mnemonic: string;
      try {
        mnemonic = await decryptMnemonic(v, pw);
      } catch {
        setErr("Wrong password.");
        return;
      }
      const { deriveBtc, deriveEth, deriveSol } = await import("@/lib/wallet");
      const [btc, eth, sol] = await Promise.all([
        deriveBtc(mnemonic),
        deriveEth(mnemonic),
        deriveSol(mnemonic),
      ]);
      setData({
        mnemonic,
        btcWif: btc.wif,
        ethKey: eth.privateKey,
        solSecret: sol.secretKey,
      });
      setPw("");
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    setData(null);
    setConfirmed(false);
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.show(`${label} copied`);
    } catch {
      toast.show("Copy failed");
    }
  }

  return (
    <div className="glass-card p-6 flex flex-col gap-3">
      <h2 className="font-semibold">Backup & private keys</h2>
      <p className="muted text-sm">
        Reveal your seed phrase or per-chain private keys. Anyone with these can drain your funds —
        only do this in a private setting and never paste them anywhere online.
      </p>
      {!data ? (
        <>
          <div className="flex gap-2">
            <input
              type="password"
              className="input flex-1"
              placeholder="Wallet password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && reveal()}
            />
            <button className="btn" onClick={reveal} disabled={busy || !pw}>
              {busy && <span className="spinner" />} Reveal
            </button>
          </div>
          {err && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {err}
            </p>
          )}
        </>
      ) : !confirmed ? (
        <div
          className="rounded-xl border p-4 flex flex-col gap-3 text-sm"
          style={{ borderColor: "var(--danger)", background: "rgba(255,80,80,0.06)" }}
        >
          <p style={{ color: "var(--danger)" }} className="font-medium">
            About to display sensitive secrets.
          </p>
          <p className="muted text-xs">
            Make sure no one is looking at your screen and you&apos;re not sharing or recording your
            display.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => setConfirmed(true)}>
              I&apos;m alone, show me
            </button>
            <button className="btn btn-ghost" onClick={hide}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SecretBlock
            label="Seed phrase (12 words)"
            value={data.mnemonic}
            onCopy={() => copy("Seed phrase", data.mnemonic)}
            mono={false}
          />
          <SecretBlock
            label="BTC private key (WIF)"
            value={data.btcWif}
            onCopy={() => copy("BTC WIF", data.btcWif)}
          />
          <SecretBlock
            label="ETH / USDT / USDC private key"
            value={data.ethKey}
            onCopy={() => copy("ETH key", data.ethKey)}
          />
          <SecretBlock
            label="SOL secret key (hex)"
            value={data.solSecret}
            onCopy={() => copy("SOL secret", data.solSecret)}
          />
          <p className="muted text-xs">
            DOT uses the same seed phrase — import it directly into Polkadot.js or Talisman.
          </p>
          <button className="btn btn-ghost w-max" onClick={hide}>
            Hide
          </button>
        </div>
      )}
    </div>
  );
}

function SecretBlock({
  label,
  value,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="label mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <button className="btn btn-ghost !py-0.5 !px-2 !text-[11px]" onClick={onCopy}>
          Copy
        </button>
      </div>
      <code
        className={`block break-all text-xs p-3 rounded-md border border-[var(--border)] bg-[var(--bg-2)]/40 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </code>
    </div>
  );
}
