"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearVault, loadPublic, type PublicState } from "@/lib/vault";
import { useToast } from "@/components/Toast";

export default function Settings() {
  const [pub, setPub] = useState<PublicState | null>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => setPub(loadPublic()), []);

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
        <Row k="Account name" v={pub?.accountName ?? "—"} />
        <Row k="Created" v={pub ? new Date(pub.createdAt).toLocaleString() : "—"} />
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
