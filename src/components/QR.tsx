"use client";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QR({ value, size = 200 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#0c0e14", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [value, size]);
  return (
    <canvas
      ref={ref}
      className="rounded-lg"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
