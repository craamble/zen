"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { newMnemonic } from "@/lib/wallet";
import { IconCopy, IconCheck } from "@/components/Icons";
import { useToast } from "@/components/Toast";

export default function CreateSeed() {
  const [mnemonic, setMnemonic] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const existing = sessionStorage.getItem("zenwallet.pending.mnemonic");
    if (existing) setMnemonic(existing);
    else {
      const m = newMnemonic();
      setMnemonic(m);
      sessionStorage.setItem("zenwallet.pending.mnemonic", m);
    }
  }, []);

  const words = mnemonic.split(" ");

  function onCopy() {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    toast.show("Seed phrase copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function onContinue() {
    router.push("/onboarding/create/name");
  }

  return (
    <div className="card p-8 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Your seed phrase</h1>
        <p className="muted text-sm mt-1">
          Write these 12 words down in order and store them somewhere safe. Anyone with this phrase
          can spend your funds.
        </p>
      </div>

      <div className="relative">
        <div className={`grid grid-cols-3 gap-2 ${revealed ? "" : "blur-md select-none"}`}>
          {words.map((w, i) => (
            <div key={i} className="seed-word">
              <span className="num">{i + 1}.</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
        {!revealed && (
          <button
            className="absolute inset-0 flex items-center justify-center btn btn-primary mx-auto my-auto max-w-xs max-h-12"
            onClick={() => setRevealed(true)}
          >
            Tap to reveal
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onCopy} disabled={!revealed}>
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
        <span className="chip">12 words · BIP39</span>
      </div>

      <div className="flex justify-between gap-3 mt-2">
        <Link href="/onboarding/create/password" className="btn btn-ghost">Back</Link>
        <button className="btn btn-primary" disabled={!revealed} onClick={onContinue}>
          I have saved it
        </button>
      </div>
    </div>
  );
}
