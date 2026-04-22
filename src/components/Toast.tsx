"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string };
const Ctx = createContext<{ show: (m: string) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
