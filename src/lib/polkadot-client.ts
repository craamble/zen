// Long-lived Polkadot ApiPromise singleton.
//
// Each `getDotBalance` / `estimateFee` / `sendDot` call previously opened a fresh
// WebSocket to wss://rpc.polkadot.io and tore it down. That's slow (the handshake
// takes ~1s on a good day) and rude to the public RPC. This module keeps one
// connection alive, hands it to callers, and auto-disconnects after a period of
// inactivity so we don't hold the socket open forever in a long-lived tab.
//
// The "lease" pattern keeps callers honest: every consumer wraps its work in
// `withDotApi(async (api) => ...)`. The module counts active leases and only
// arms the idle-disconnect timer when there are zero outstanding leases.

import type { ApiPromise } from "@polkadot/api";

const DOT_WS = "wss://rpc.polkadot.io";
const IDLE_DISCONNECT_MS = 30_000;

let apiPromise: Promise<ApiPromise> | null = null;
let leases = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

async function open(): Promise<ApiPromise> {
  const { ApiPromise: ApiPromiseCtor, WsProvider } = await import("@polkadot/api");
  const provider = new WsProvider(DOT_WS);
  const api = await ApiPromiseCtor.create({ provider });
  return api;
}

function armIdleDisconnect() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (leases > 0 || !apiPromise) return;
    const p = apiPromise;
    apiPromise = null;
    try {
      const api = await p;
      await api.disconnect();
    } catch { /* ignore */ }
  }, IDLE_DISCONNECT_MS);
}

/**
 * Run `fn` with a shared, long-lived ApiPromise instance.
 * The connection is automatically disconnected after IDLE_DISCONNECT_MS of inactivity.
 */
export async function withDotApi<T>(fn: (api: ApiPromise) => Promise<T>): Promise<T> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!apiPromise) apiPromise = open();
  leases++;
  try {
    const api = await apiPromise;
    return await fn(api);
  } finally {
    leases--;
    if (leases === 0) armIdleDisconnect();
  }
}
