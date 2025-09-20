import React from "react";

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
  const Label = ({ children }: { children: React.ReactNode }) => (
    <span className="text-slate-400">{children}</span>
  );

  const BaseInput = ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    disabled: boolean;
  }) => (
    <input
      value={value}
      onChange={(e) => {
        if (!disabled) onChange(e.target.value.trim());
      }}
      placeholder={placeholder}
      className={`w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-indigo-500/40 ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
      disabled={disabled}
      readOnly={disabled}
      aria-disabled={disabled}
      aria-readonly={disabled}
    />
  );

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

      <label className="grid gap-1 text-xs">
        <Label>Escrow</Label>
        <BaseInput
          value={escrowAddr}
          onChange={setEscrowAddr}
          placeholder="0x… (UsdEscrow_BNB_USDT)"
          disabled={!!readOnlyEscrow}
        />
      </label>

      <label className="grid gap-1 text-xs">
        <Label>USDT</Label>
        <BaseInput
          value={usdtAddr}
          onChange={setUsdtAddr}
          placeholder="0x… (MockERC20Dec)"
          disabled={!!readOnlyDeps}
        />
      </label>

      <label className="grid gap-1 text-xs">
        <Label>WBNB</Label>
        <BaseInput
          value={wbnbAddr}
          onChange={setWbnbAddr}
          placeholder="0x… (WrappedNativeMock)"
          disabled={!!readOnlyDeps}
        />
      </label>

      <label className="grid gap-1 text-xs">
        <Label>BNB / USD Feed</Label>
        <BaseInput
          value={bnbUsdFeed}
          onChange={setBnbUsdFeed}
          placeholder="0x… (PriceFeedMock)"
          disabled={!!readOnlyDeps}
        />
      </label>

      <label className="grid gap-1 text-xs">
        <Label>USDT / USD Feed</Label>
        <BaseInput
          value={usdtUsdFeed}
          onChange={setUsdtUsdFeed}
          placeholder="0x… (PriceFeedMock)"
          disabled={!!readOnlyDeps}
        />
      </label>
    </div>
  );
}
