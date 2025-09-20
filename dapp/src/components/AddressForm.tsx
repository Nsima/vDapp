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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  const id = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="grid gap-1 text-xs" htmlFor={id}>
      <span className="text-slate-400">{label}</span>
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
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {(readOnlyEscrow || readOnlyDeps) && disabledReason ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1">
              <span>🔒</span>
              <span>{disabledReason}</span>
            </span>
          ) : (
            <span className="text-slate-500">Paste addresses or auto-fill from escrow.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
                Lock derived addresses
              </button>
            ))}

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

      <div className="grid md:grid-cols-2 gap-3">
        <LabeledInput
          label="Escrow"
          value={escrowAddr}
          onChange={setEscrowAddr}
          placeholder="0x… (UsdEscrow_BNB_USDT)"
          disabled={!!readOnlyEscrow}
        />

        <LabeledInput
          label="USDT"
          value={usdtAddr}
          onChange={setUsdtAddr}
          placeholder="0x… (MockERC20Dec)"
          disabled={!!readOnlyDeps}
        />

        <LabeledInput
          label="WBNB"
          value={wbnbAddr}
          onChange={setWbnbAddr}
          placeholder="0x… (WrappedNativeMock)"
          disabled={!!readOnlyDeps}
        />

        <LabeledInput
          label="BNB / USD Feed"
          value={bnbUsdFeed}
          onChange={setBnbUsdFeed}
          placeholder="0x… (PriceFeedMock)"
          disabled={!!readOnlyDeps}
        />

        <LabeledInput
          label="USDT / USD Feed"
          value={usdtUsdFeed}
          onChange={setUsdtUsdFeed}
          placeholder="0x… (PriceFeedMock)"
          disabled={!!readOnlyDeps}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 -mt-1">
        <span className="text-[11px] text-slate-500">
          Shareable URL includes escrow, deal, and contract addresses. Party B can open and just “Approve + Fund”.
        </span>
      </div>
    </div>
  );
}
