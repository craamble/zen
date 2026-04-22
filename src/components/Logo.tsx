export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="ZenWallet"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

export function LogoWordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={size} />
      <span className="font-semibold tracking-tight text-[var(--foreground)]">
        ZenWallet
      </span>
    </span>
  );
}
