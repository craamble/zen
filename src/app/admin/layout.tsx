import { LogoWordmark } from "@/components/Logo";
import { ToastProvider } from "@/components/Toast";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <header className="px-8 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <LogoWordmark />
            <span className="chip">Admin</span>
          </div>
          <Link href="/" className="btn btn-ghost text-sm">Back to wallet</Link>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
