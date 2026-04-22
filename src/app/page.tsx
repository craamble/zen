"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadVault, getSessionMnemonic } from "@/lib/vault";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const v = loadVault();
    if (!v) {
      router.replace("/onboarding");
      return;
    }
    if (getSessionMnemonic()) router.replace("/portfolio");
    else router.replace("/unlock");
  }, [router]);
  return (
    <div className="flex-1 flex items-center justify-center">
      <span className="spinner" />
    </div>
  );
}
