import { LogoWordmark } from "@/components/Logo";
import { ToastProvider } from "@/components/Toast";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <header className="px-8 py-6 border-b border-[var(--border)]">
          <LogoWordmark />
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
