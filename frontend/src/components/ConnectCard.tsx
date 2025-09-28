import React, { useMemo } from "react";
import Info from "./Info";

type Props = {
  connected: boolean;
  onConnect: () => void;
  account: string;
  chainId: number | null;          // wallet chain
  onLocal: boolean;
  error: string;

  // NEW (optional)
  readChainId?: number | null;     // read provider chain (from VITE_READ_RPC / localStorage.READ_RPC / injected)
  targetChainId?: number | null;   // what your app expects (e.g., 56 for BSC)
  onSwitchNetwork?: () => void;    // optional: switch wallet to target
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  5: "Goerli",
  11155111: "Sepolia",
  56: "BNB Smart Chain",
  97: "BSC Testnet",
  137: "Polygon",
  10: "Optimism",
  42161: "Arbitrum One",
  8453: "Base",
  31337: "Hardhat",
  1337: "Local",
};

function nameFor(id?: number | null) {
  if (id == null) return "Unknown";
  return CHAIN_NAMES[id] || `Chain ${id}`;
}

function hostFrom(urlLike?: string | null) {
  if (!urlLike) return "injected";
  try { return new URL(urlLike).host || urlLike; } catch { return urlLike; }
}

export default function ConnectCard({
  connected, onConnect, account, chainId, onLocal, error,
  readChainId = null, targetChainId = null, onSwitchNetwork
}: Props) {

  // read RPC text (for the tips box)
  const readRpc = (import.meta as any)?.env?.VITE_READ_RPC || localStorage.getItem("READ_RPC") || (onLocal ? "http://127.0.0.1:8545" : null);
  const readRpcHost = useMemo(() => hostFrom(readRpc), [readRpc]);

  const walletMatchesTarget = targetChainId == null || (chainId != null && chainId === targetChainId);
  const readMatchesTarget   = targetChainId == null || (readChainId != null && readChainId === targetChainId);

  return (
    <div className="mt-8 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6">
        {!connected ? (
          <div className="grid gap-5">
            <div className="text-sm text-slate-300">Connect MetaMask to get started</div>

            <button
              onClick={onConnect}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] hover:shadow-[0_10px_38px_-10px_rgba(236,72,153,0.55)] transition-all active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12h12M12 6v12"/></svg>
              Connect Wallet
            </button>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">
                {error}
              </div>
            )}

            {/* Dynamic tips (no more hardcoded mainnet/1) */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] text-slate-400 font-medium mb-1">Tips</div>
              <ul className="text-[12px] text-slate-400 list-disc ml-5 space-y-1">
                <li>
                  Read RPC: <code className="text-slate-300">{readRpcHost}</code> · Chain{" "}
                  <span className="text-slate-300">{readChainId ?? "unknown"}</span>
                </li>
                <li>
                  Wallet: <span className="text-slate-300">Not connected</span>
                  {targetChainId != null && (
                    <> · Expected chain <span className="text-slate-300">{targetChainId}</span></>
                  )}
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Account" value={`${account.slice(0,6)}…${account.slice(-4)}`} />
              <Info
                label="Wallet Chain"
                value={`${nameFor(chainId)}${chainId != null ? ` (${chainId})` : ""}`}
                highlight={!walletMatchesTarget}
              />
            </div>

            {/* Read/Target quick status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className={`rounded-md px-2 py-1 ring-1 ${readMatchesTarget ? "bg-emerald-600/20 text-emerald-200 ring-emerald-300/30" : "bg-amber-600/20 text-amber-200 ring-amber-300/30"}`}>
                Read: {nameFor(readChainId)}{readChainId != null ? ` (${readChainId})` : ""}
              </div>
              <div className={`rounded-md px-2 py-1 ring-1 ${walletMatchesTarget ? "bg-emerald-600/20 text-emerald-200 ring-emerald-300/30" : "bg-amber-600/20 text-amber-200 ring-amber-300/30"}`}>
                Wallet: {nameFor(chainId)}{chainId != null ? ` (${chainId})` : ""}
              </div>
              <div className="rounded-md px-2 py-1 ring-1 bg-slate-800/60 text-slate-200 ring-white/10">
                Target: {nameFor(targetChainId)}{targetChainId != null ? ` (${targetChainId})` : ""}
              </div>
            </div>

            {/* Offer a one-click switch when mismatched */}
            {!walletMatchesTarget && onSwitchNetwork && (
              <div className="flex items-center justify-between rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-300/30 px-3 py-2 text-[12px]">
                <span>Your wallet is on {nameFor(chainId)}; this app expects {nameFor(targetChainId)}.</span>
                <button
                  onClick={onSwitchNetwork}
                  className="rounded-md bg-amber-600 hover:bg-amber-500 px-2 py-1 text-[11px]"
                >
                  Switch network
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
