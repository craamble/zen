"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValidMnemonic } from "@/lib/wallet";

export default function ImportSeed() {
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function setWord(i: number, v: string) {
    const next = [...words];
    next[i] = v.trim().toLowerCase();
    setWords(next);
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    const parts = text.split(/\s+/);
    if (parts.length === 12) {
      e.preventDefault();
      setWords(parts.map((p) => p.toLowerCase()));
    }
  }

  function onContinue() {
    setErr(null);
    const mnemonic = words.map((w) => w.trim().toLowerCase()).join(" ");
    if (words.some((w) => !w)) {
      setErr("Fill in all 12 words.");
      return;
    }
    if (!isValidMnemonic(mnemonic)) {
      setErr("Invalid seed phrase checksum. Check your words.");
      return;
    }
    sessionStorage.setItem("zenwallet.pending.mnemonic", mnemonic);
    router.push("/onboarding/import/name");
  }

  return (
    <div className="card p-8 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Import seed phrase</h1>
        <p className="muted text-sm mt-1">
          Enter your 12-word phrase below. You can paste the full phrase into any field.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {words.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="muted text-xs min-w-5 text-right">{i + 1}.</span>
            <input
              className="input font-mono text-sm"
              value={w}
              onChange={(e) => setWord(i, e.target.value)}
              onPaste={onPaste}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="flex justify-between gap-3 mt-2">
        <Link href="/onboarding/import/password" className="btn btn-ghost">Back</Link>
        <button className="btn btn-primary" onClick={onContinue}>
          Import account
        </button>
      </div>
    </div>
  );
}
