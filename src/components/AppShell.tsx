"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { IconLock, IconWallet, IconClock, IconGear, IconHelp } from "./Icons";
import {
  clearSession,
  loadAutoLockMinutes,
  loadPublic,
  loadVault,
  type PublicState,
} from "@/lib/vault";
import { ToastProvider } from "./Toast";
import { NotificationsBell } from "./NotificationsBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pub, setPub] = useState<PublicState | null>(null);
  const lockTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    if (!loadVault()) {
      router.replace("/onboarding");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPub(loadPublic());
  }, [router]);

  // Auto-lock on inactivity. Listens for any user activity and resets a timer
  // that, when it fires, clears the session mnemonic and routes to /unlock.
  useEffect(() => {
    if (!pub) return; // not authed yet
    const minutes = loadAutoLockMinutes();
    if (minutes <= 0) return; // "Never" — feature disabled

    const idleMs = minutes * 60 * 1000;

    function lockNow() {
      clearSession();
      router.replace("/unlock");
    }
    function arm() {
      if (lockTimerRef.current !== null) window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = window.setTimeout(lockNow, idleMs);
    }
    function onActivity() {
      const now = Date.now();
      // Throttle: only restart the timer once per second to avoid thrash on mousemove.
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;
      arm();
    }
    function onVisibility() {
      // If the tab was hidden longer than the idle window, lock immediately on return.
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActivityRef.current >= idleMs) {
          lockNow();
          return;
        }
        arm();
      }
    }

    arm();
    const events: (keyof DocumentEventMap | keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (lockTimerRef.current !== null) window.clearTimeout(lockTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pub, pathname, router]);

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
        <aside className="hidden md:flex w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)]/40 backdrop-blur-xl flex-col h-screen sticky top-0 self-start overflow-y-auto">
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
          <header className="relative z-40 flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 border-b border-[var(--border)] bg-[var(--bg-1)]/20 backdrop-blur-md">
            <Link href="/portfolio" className="md:hidden flex items-center" aria-label="Home">
              <Logo size={32} />
            </Link>
            <div className="flex-1 md:hidden" />
            <div className="hidden md:block flex-1" />
            {pub?.accountId && <NotificationsBell accountId={pub.accountId} />}
            {pub && (
              <div className="flex items-center gap-2.5 pl-1 pr-2 md:pr-3 py-1 rounded-full bg-[var(--bg-2)]/50 border border-[var(--border)]">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                    color: "#0c0e14",
                  }}
                >
                  {initial}
                </span>
                <span className="hidden sm:inline text-sm truncate max-w-[120px]">{pub.accountName}</span>
              </div>
            )}
            <button
              className="btn btn-ghost !p-2 md:!p-2.5"
              aria-label="Lock wallet"
              title="Lock wallet"
              onClick={onLock}
            >
              <IconLock />
            </button>
          </header>
          <div className="flex-1 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10">{children}</div>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-1)]/85 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-3">
            {nav.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors ${
                    active ? "text-[var(--accent)]" : "text-[var(--fg-1)]"
                  }`}
                >
                  <span>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ToastProvider>
  );
}
