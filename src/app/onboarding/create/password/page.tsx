"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreatePassword() {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [ack, setAck] = useState(false);
  const router = useRouter();

  const tooShort = pw1.length > 0 && pw1.length < 8;
  const mismatch = pw2.length > 0 && pw1 !== pw2;
  const valid = pw1.length >= 8 && pw1 === pw2 && ack;

  function onContinue() {
    sessionStorage.setItem("zenwallet.pending.password", pw1);
    router.push("/onboarding/create/seed");
  }

  return (
    <div className="card p-8 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Create password</h1>
        <p className="muted text-sm mt-1">
          Used to encrypt your wallet on this device.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="At least 8 characters"
          autoFocus
        />
        {tooShort && <p className="text-xs" style={{ color: "var(--danger)" }}>Too short.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <label className="label">Repeat password</label>
        <input
          className="input"
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        {mismatch && <p className="text-xs" style={{ color: "var(--danger)" }}>Passwords don&apos;t match.</p>}
      </div>
      <label className="flex items-start gap-3 cursor-pointer select-none mt-1">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--accent)]"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        <span className="text-sm subtle">
          I understand that ZenWallet cannot recover this password if I lose it.
        </span>
      </label>
      <div className="flex justify-between gap-3 mt-2">
        <Link href="/onboarding/create/terms" className="btn btn-ghost">Back</Link>
        <button className="btn btn-primary" disabled={!valid} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
