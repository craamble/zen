"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. You are solely responsible for safeguarding your seed phrase and password. ZenWallet cannot recover them.`;

export default function ImportTerms() {
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();
  return (
    <div className="card p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Terms of use</h1>
        <p className="muted text-sm mt-1">Please review before continuing.</p>
      </div>
      <div className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-5 h-64 overflow-y-auto text-sm subtle leading-relaxed">
        {LOREM}
      </div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--accent)]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span className="text-sm subtle">I&apos;ve read and agree to the Terms of Use.</span>
      </label>
      <div className="flex gap-3 justify-between">
        <Link href="/onboarding" className="btn btn-ghost">Back</Link>
        <button
          className="btn btn-primary"
          disabled={!agreed}
          onClick={() => router.push("/onboarding/import/password")}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
