import React from "react";

type Props = {
  // existing
  onLocal?: boolean;
  chainId?: number | null;          // wallet chain id
  activeStep?: number;
  title?: string;
  logoSrc?: string;
  logoAlt?: string;

  // NEW
  readChainId?: number | null;      // read provider chain id (from VITE_READ_RPC/localStorage READ_RPC or injected)
  targetChainId?: number | null;    // what the app expects (e.g., 56 for BSC)
  onSwitchNetwork?: () => void;     // optional: call to switch wallet to target
};

const steps = ["Connect", "Create/Join", "Fund/Settle", "Complete"];

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

function badgeClass(ok: boolean, neutral = false) {
  if (neutral) return "bg-slate-800/70 text-slate-300 ring-1 ring-white/10";
  return ok
    ? "bg-emerald-600/70 text-white ring-1 ring-emerald-300/30"
    : "bg-amber-600/70 text-white ring-1 ring-amber-300/30";
}

export default function Header({
  onLocal,
  chainId,
  activeStep = 1,
  title = "Vessel Escrow",
  logoSrc = "/icon.png",
  logoAlt = "Logo",

  // NEW
  readChainId,
  targetChainId,
  onSwitchNetwork,
}: Props) {
  const walletMatchesTarget =
    targetChainId == null || (chainId != null && chainId === targetChainId);
  const readMatchesTarget =
    targetChainId == null || (readChainId != null && readChainId === targetChainId);

  // legacy single-label (kept for backwards compatibility / tooltip)
  const netLabel =
    chainId == null
      ? "Network: Unknown"
      : onLocal
      ? "Network: Localhost"
      : `Chain ID: ${chainId}`;

  return (
    <header className="flex flex-col gap-3">
      {/* Brand row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt || "Logo"}
              className="h-8 w-8 rounded-lg ring-1 ring-white/10 object-contain bg-white/5"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <h1 className="text-lg font-semibold tracking-tight text-white">{title}</h1>
        </div>

        {/* Network badges */}
        <div className="flex items-center gap-2">
          {/* Read */}
          <span
            className={
              "rounded-md px-2 py-1 text-[11px] " +
              badgeClass(readMatchesTarget, readChainId == null && targetChainId == null)
            }
            title={`Read provider → ${netLabel}`}
          >
            Read: {nameFor(readChainId)}{" "}
            {readChainId != null ? `(${readChainId})` : ""}
          </span>

          {/* Wallet */}
          <span
            className={
              "rounded-md px-2 py-1 text-[11px] " +
              badgeClass(walletMatchesTarget, chainId == null && targetChainId == null)
            }
            title={netLabel}
          >
            Wallet: {nameFor(chainId)} {chainId != null ? `(${chainId})` : ""}
          </span>

          {/* Target (only if provided) */}
          {targetChainId != null && (
            <span
              className={
                "rounded-md px-2 py-1 text-[11px] " +
                badgeClass(true, true)
              }
              title="App target network"
            >
              Target: {nameFor(targetChainId)} ({targetChainId})
            </span>
          )}

          {/* Switch button if mismatch & handler provided */}
          {!walletMatchesTarget && onSwitchNetwork && (
            <button
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-[11px]"
              onClick={onSwitchNetwork}
              title="Switch wallet to target network"
            >
              Switch
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const idx = i + 1;
          const isActive = idx === activeStep;
          const isDone = idx < activeStep;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={[
                  "h-6 min-w-6 rounded-full px-2 text-[11px] grid place-items-center",
                  isDone
                    ? "bg-emerald-600/70 text-white ring-1 ring-emerald-300/30"
                    : isActive
                    ? "bg-indigo-600/80 text-white ring-1 ring-indigo-300/30"
                    : "bg-slate-800/70 text-slate-300 ring-1 ring-white/10",
                ].join(" ")}
                title={s}
              >
                {idx}
              </div>
              <span className="text-[11px] text-slate-300">{s}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-white/10" />}
            </div>
          );
        })}
      </div>
    </header>
  );
}
