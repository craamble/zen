export default function Support() {
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
      <div className="glass-card p-6 flex flex-col gap-3">
        <p className="subtle">Need help? Contact us at support@zenwallet.local.</p>
        <p className="muted text-sm">
          We can never recover your password or seed phrase. If you&apos;ve lost either, your funds
          are only recoverable via the other.
        </p>
      </div>
    </div>
  );
}
