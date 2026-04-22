"use client";
import { useEffect, useRef, useState } from "react";
import { IconBell } from "./Icons";

type Notification = {
  id: string;
  account_id: string | null;
  title: string;
  body: string;
  created_at: number;
};

const POLL_MS = 30_000;
const lastReadKey = (id: string) => `zenwallet.notif.lastRead.${id}`;

export function NotificationsBell({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastRead, setLastRead] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLastRead(Number(localStorage.getItem(lastReadKey(accountId)) ?? 0));
  }, [accountId]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch(`/api/notifications?accountId=${encodeURIComponent(accountId)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!stop) setItems(d.notifications ?? []);
      } catch { /* ignore */ }
    }
    tick();
    const h = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(h); };
  }, [accountId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = items.filter((n) => n.created_at > lastRead).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      const now = Date.now();
      localStorage.setItem(lastReadKey(accountId), String(now));
      setLastRead(now);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        className="btn btn-ghost !p-2.5 relative"
        aria-label="Notifications"
        title="Notifications"
        onClick={toggle}
      >
        <IconBell />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
            style={{ background: "var(--danger)", color: "white" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-1)] shadow-2xl z-50"
        >
          <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm muted text-center">No notifications yet.</div>
          ) : (
            <ul className="flex flex-col">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 border-b border-[var(--border)] last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-[11px] muted whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-sm subtle mt-1 whitespace-pre-wrap">{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
