"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { clearVault, decryptMnemonic, loadVault, setSessionMnemonic } from "@/lib/vault";

export default function Unlock() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onUnlock() {
    setErr(null);
    setBusy(true);
    try {
      const v = loadVault();
      if (!v) {
        router.replace("/onboarding");
        return;
      }
      const mnemonic = await decryptMnemonic(v, pw);
      setSessionMnemonic(mnemonic);
      router.replace("/portfolio");
    } catch {
      setErr("Wrong password.");
      setBusy(false);
    }
  }

  function onReset() {
    if (!confirm("Remove this wallet from this device? You'll need your seed phrase to restore.")) return;
    clearVault();
    router.replace("/onboarding");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-10 w-full max-w-md flex flex-col gap-5 items-center text-center">
        <Logo size={64} />
        <div>
          <h1 className="text-2xl font-semibold">Unlock ZenWallet</h1>
          <p className="muted text-sm mt-1">Enter your password to continue.</p>
        </div>
        <input
          type="password"
          className="input"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onUnlock()}
          placeholder="Password"
          autoFocus
        />
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
        <button className="btn btn-primary w-full" disabled={!pw || busy} onClick={onUnlock}>
          {busy && <span className="spinner" />} Unlock
        </button>
        <button className="btn btn-ghost text-xs" onClick={onReset}>
          Forgot password? Reset wallet
        </button>
      </div>
    </div>
  );
}
