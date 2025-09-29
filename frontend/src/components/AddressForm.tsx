import React, { useState } from "react";

type Props = {
  escrowAddr: string;
  setEscrowAddr: (v: string) => void;

  usdtAddr: string;
  setUsdtAddr: (v: string) => void;

  wbnbAddr: string;
  setWbnbAddr: (v: string) => void;

  bnbUsdFeed: string;
  setBnbUsdFeed: (v: string) => void;

  usdtUsdFeed: string;
  setUsdtUsdFeed: (v: string) => void;

  loadFromEscrow: () => Promise<void> | void;
  copyShare: () => Promise<void> | void;
  copied: boolean;

  escrow: any;

  // Locking controls
  readOnlyEscrow?: boolean;      // lock Escrow input
  readOnlyDeps?: boolean;        // lock USDT/WBNB/feeds inputs
  disabledReason?: string;       // message shown when locked
  showLockToggle?: boolean;      // show Lock/Unlock for deps
  onUnlock?: () => void;
  onLock?: () => void;
};

/** Canonical BSC mainnet addresses */
const BSC_PRESET = {
  // Native BNB has no contract address; WBNB is the ERC-20/BEP-20 wrapper:
  WBNB: "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  // Binance-Peg USDT (BSC):
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  // Chainlink price feeds (AggregatorV3Interface):
  BNB_USD: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
  USDT_USD: "0xB97Ad0E74fa7d920791E90258A6E2085088b4320",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = (value ?? "").length > 0;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      disabled={!canCopy}
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] ring-1 ring-white/10
        ${canCopy ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-800 opacity-50 cursor-not-allowed"}`}
      title={canCopy ? "Copy to clipboard" : "Nothing to copy"}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
  help?: string;
}) {
  const id = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="grid gap-1 text-xs" htmlFor={id}>
      <span className="text-slate-300">{label}</span>
      {help && <span className="text-[11px] text-slate-500">{help}</span>}
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            if (!disabled) onChange(e.target.value.trim());
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg bg-slate-800 px-3 py-2 pr-20 text-sm outline-none ring-1 ring-white/10 focus:ring-indigo-500/40 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={disabled}
          readOnly={disabled}
          aria-disabled={disabled}
          aria-readonly={disabled}
        />
        <CopyButton value={value} />
      </div>
    </label>
  );
}

export default function AddressForm({
  escrowAddr, setEscrowAddr,
  usdtAddr, setUsdtAddr,
  wbnbAddr, setWbnbAddr,
  bnbUsdFeed, setBnbUsdFeed,
  usdtUsdFeed, setUsdtUsdFeed,
  loadFromEscrow, copyShare, copied, escrow,
  readOnlyEscrow = false,
  readOnlyDeps = false,
  disabledReason,
  showLockToggle = false,
  onUnlock,
  onLock,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fillBscDefaults = (force = false) => {
    if (readOnlyDeps) return; // respect lock
    if (force || !usdtAddr) setUsdtAddr(BSC_PRESET.USDT);
    if (force || !wbnbAddr) setWbnbAddr(BSC_PRESET.WBNB);
    if (force || !bnbUsdFeed) setBnbUsdFeed(BSC_PRESET.BNB_USD);
    if (force || !usdtUsdFeed) setUsdtUsdFeed(BSC_PRESET.USDT_USD);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-slate-400">
          {(readOnlyEscrow || readOnlyDeps) && disabledReason ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1">
              <span>🔒</span>
              <span>{disabledReason}</span>
            </span>
          ) : (
            <div className="space-y-1">
              <p className="text-slate-400">
                This deal escrows <b>BNB (native)</b> from Party&nbsp;A and <b>USDT (BEP-20)</b> from Party&nbsp;B on BSC.
              </p>
              <p className="text-slate-500">
                <b>WBNB</b> is used <i>internally by the contract</i> for wrap/unwrap; you still fund with <b>native BNB</b>.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* BSC defaults (click: fill blanks • Shift+Click: overwrite) */}
          <button
            onClick={(e) => fillBscDefaults((e as any).shiftKey === true)}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[11px]"
            title="Click: fill blanks • Shift+Click: overwrite all with BSC mainnet addresses"
            disabled={readOnlyDeps}
          >
            BSC Defaults
          </button>

          {showLockToggle &&
            (readOnlyDeps ? (
              <button
                onClick={onUnlock}
                className="rounded-md bg-amber-600 hover:bg-amber-500 px-2 py-1 text-[11px]"
                title="Edit derived addresses manually"
              >
                Unlock to override
              </button>
            ) : (
              <button
                onClick={onLock}
                className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px]"
                title="Re-lock derived addresses"
              >
                Lock derived
              </button>
            ))}

          {/* Auto-fill from escrow (reads USDT/WBNB/feeds from the escrow contract) */}
          <button
            onClick={loadFromEscrow}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-[11px]"
            disabled={!escrow}
            title={!escrow ? "Enter a valid escrow address first" : "Read addresses from escrow"}
          >
            Auto-fill from Escrow
          </button>

          <button
            onClick={copyShare}
            className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px]"
          >
            {copied ? "Link Copied!" : "Copy Share Link"}
          </button>
        </div>
      </div>

      {/* Escrow & USDT + Feeds (visible) */}
      <div className="grid md:grid-cols-2 gap-3">
        <LabeledInput
          label="Escrow (your deployment)"
          value={escrowAddr}
          onChange={setEscrowAddr}
          placeholder="0x… (UsdEscrow_BNB_USDT)"
          disabled={!!readOnlyEscrow}
        />

        <LabeledInput
          label="USDT (BSC mainnet)"
          value={usdtAddr}
          onChange={setUsdtAddr}
          placeholder={BSC_PRESET.USDT}
          disabled={!!readOnlyDeps}
        />

        <LabeledInput
          label="BNB / USD Feed (Chainlink)"
          value={bnbUsdFeed}
          onChange={setBnbUsdFeed}
          placeholder={BSC_PRESET.BNB_USD}
          disabled={!!readOnlyDeps}
        />

        <LabeledInput
          label="USDT / USD Feed (Chainlink)"
          value={usdtUsdFeed}
          onChange={setUsdtUsdFeed}
          placeholder={BSC_PRESET.USDT_USD}
          disabled={!!readOnlyDeps}
        />
      </div>

      {/* Advanced: WBNB (internal) */}
      <div className="rounded-lg border border-white/10">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-xs text-slate-400">
            <b>Advanced</b> — contract internals
            <span className="ml-2 text-[11px] text-slate-500">
              WBNB address used by the contract for wrapping native BNB.
            </span>
          </div>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px]"
          >
            {showAdvanced ? "Hide" : "Show"}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-3 pt-0">
            <LabeledInput
              label="WBNB (internal)"
              value={wbnbAddr}
              onChange={setWbnbAddr}
              placeholder={BSC_PRESET.WBNB}
              disabled={!!readOnlyDeps}
              help="Internal dependency only — users still fund with native BNB."
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 -mt-1">
        <span className="text-[11px] text-slate-500">
          Shareable URL includes escrow, deal, and contract addresses. Party B opens the link and simply “Approve + Fund”.
        </span>
      </div>
    </div>
  );
}
