"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { IconLock, IconWallet, IconClock, IconGear, IconHelp } from "./Icons";
import { clearSession, loadPublic, loadVault, type PublicState } from "@/lib/vault";
import { ToastProvider } from "./Toast";
import { NotificationsBell } from "./NotificationsBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pub, setPub] = useState<PublicState | null>(null);

  useEffect(() => {
    if (!loadVault()) {
      router.replace("/onboarding");
      return;
    }
    setPub(loadPublic());
  }, [router]);

  function onLock() {
    clearSession();
    router.replace("/unlock");
  }

  const nav = [
    { href: "/portfolio", label: "Portfolio", icon: <IconWallet /> },
    { href: "/history", label: "History", icon: <IconClock /> },
    { href: "/settings", label: "Settings", icon: <IconGear /> },
  ];

  const initial = pub?.accountName?.[0]?.toUpperCase() ?? "?";

  return (
    <ToastProvider>
      <div className="min-h-screen flex">
        <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)]/40 backdrop-blur-xl flex flex-col">
          <div className="p-6 flex items-center justify-center">
            <Logo size={120} />
          </div>
          <nav className="px-3 flex flex-col gap-0.5">
            {nav.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-[var(--bg-2)]/70 text-[var(--fg-0)] border border-[var(--border)]"
                      : "text-[var(--fg-1)] hover:bg-[var(--bg-2)]/40 border border-transparent"
                  }`}
                >
                  <span className={active ? "text-[var(--accent)]" : ""}>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          <div className="px-3 pb-4 pt-4 border-t border-[var(--border)] flex flex-col gap-0.5">
            <Link
              href="/support"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                pathname.startsWith("/support")
                  ? "bg-[var(--bg-2)]/70 text-[var(--fg-0)] border border-[var(--border)]"
                  : "text-[var(--fg-1)] hover:bg-[var(--bg-2)]/40 border border-transparent"
              }`}
            >
              <span className={pathname.startsWith("/support") ? "text-[var(--accent)]" : ""}>
                <IconHelp />
              </span>
              Support
            </Link>
            <Link
              href="/terms"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                pathname.startsWith("/terms")
                  ? "bg-[var(--bg-2)]/70 text-[var(--fg-0)] border border-[var(--border)]"
                  : "text-[var(--fg-1)] hover:bg-[var(--bg-2)]/40 border border-transparent"
              }`}
            >
              <span className={pathname.startsWith("/terms") ? "text-[var(--accent)]" : ""}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </span>
              Terms of service
            </Link>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative z-40 flex items-center justify-end gap-3 px-8 py-4 border-b border-[var(--border)] bg-[var(--bg-1)]/20 backdrop-blur-md">
            {pub?.accountId && <NotificationsBell accountId={pub.accountId} />}
            {pub && (
              <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-[var(--bg-2)]/50 border border-[var(--border)]">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                    color: "#0c0e14",
                  }}
                >
                  {initial}
                </span>
                <span className="text-sm">{pub.accountName}</span>
              </div>
            )}
            <button
              className="btn btn-ghost !p-2.5"
              aria-label="Lock wallet"
              title="Lock wallet"
              onClick={onLock}
            >
              <IconLock />
            </button>
          </header>
          <div className="flex-1 px-8 py-10">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
