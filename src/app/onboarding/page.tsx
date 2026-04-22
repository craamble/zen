"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Welcome() {
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-6">
      <Logo size={72} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to ZenWallet</h1>
        <p className="mt-3 subtle max-w-md mx-auto">
          Choose how you&apos;d like to set up your wallet. ZenWallet supports Bitcoin, Ethereum,
          Solana, Polkadot, USDT and USDC.
        </p>
      </div>
      <div className="w-full flex flex-col gap-3 mt-2">
        <Link className="btn btn-primary w-full py-3" href="/onboarding/create/terms">
          Create a new account
        </Link>
        <Link className="btn w-full py-3" href="/onboarding/import/terms">
          Import existing account
        </Link>
      </div>
    </div>
  );
}
