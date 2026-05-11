"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TermsContent } from "@/components/TermsContent";

export default function CreateTerms() {
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();
  return (
    <div className="card p-6 md:p-8 flex flex-col gap-5 w-full max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Terms of use</h1>
        <p className="muted text-sm mt-1">Please review before continuing.</p>
      </div>
      <div className="bg-[var(--bg-2)]/60 border border-[var(--border)] rounded-xl px-5 py-4 h-[420px] md:h-[480px] overflow-y-auto">
        <TermsContent />
      </div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--accent)]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span className="text-sm subtle">
          I&apos;ve read and agree to the Terms of Use.
        </span>
      </label>
      <div className="flex gap-3 justify-between">
        <Link href="/onboarding" className="btn btn-ghost">
          Back
        </Link>
        <button
          className="btn btn-primary"
          disabled={!agreed}
          onClick={() => router.push("/onboarding/create/password")}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
