// Centralized RPC / API endpoints. Default to free, no-key, CORS-open
// public providers. Each is overridable via NEXT_PUBLIC_*_RPC env var so a
// production deployment can swap to keyed providers (Alchemy, Helius,
// OnFinality, etc.) without code changes.

export const ETH_RPC =
  process.env.NEXT_PUBLIC_ETH_RPC ?? "https://ethereum-rpc.publicnode.com";

export const SOL_RPC =
  process.env.NEXT_PUBLIC_SOL_RPC ?? "https://solana-rpc.publicnode.com";

// Polkadot Asset Hub (the new default home for DOT activity post-2024
// migration). Same address format as the relay chain (ss58 prefix 0),
// same `balances.transferKeepAlive` extrinsic, cheaper fees.
export const DOT_WS =
  process.env.NEXT_PUBLIC_DOT_WS ?? "wss://polkadot-asset-hub-rpc.polkadot.io";

export const BTC_API =
  process.env.NEXT_PUBLIC_BTC_API ?? "https://mempool.space/api";
