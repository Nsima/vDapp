// src/components/ComputePanel.tsx
import React, { useMemo, useState } from "react";

type Props = {
  computeNeeds: () => Promise<void> | void;
  computing: boolean;
  needWBNB?: bigint | null; // internal calc uses WBNB decimals, but users fund native BNB
  needUSDT?: bigint | null;
  feedBNB: boolean;
  feedUSDT: boolean;
  usdt: boolean;
  wbnb: boolean;              // internal dependency check
  fmt: (v: bigint, d?: number) => string;
};

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = value && value !== "-";
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        } catch {}
      }}
      disabled={!canCopy}
      className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-white/10 ${
        canCopy ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-800 opacity-50 cursor-not-allowed"
      }`}
      title={canCopy ? `Copy ${label ?? "value"}` : "Nothing to copy"}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export default function ComputePanel({
  computeNeeds,
  computing,
  needWBNB,
  needUSDT,
  feedBNB,
  feedUSDT,
  usdt,
  wbnb,
  fmt,
}: Props) {
  // Ready to compute when all deps present (feeds + tokens)
  const canCompute = feedBNB && feedUSDT && usdt && wbnb;

  const missing = useMemo(() => {
    const out: string[] = [];
    if (!feedBNB) out.push("BNB/USD feed");
    if (!feedUSDT) out.push("USDT/USD feed");
    if (!usdt) out.push("USDT token");
    if (!wbnb) out.push("WBNB token (internal)");
    return out;
  }, [feedBNB, feedUSDT, usdt, wbnb]);

  // Display strings (BNB native shown, but amount computed with WBNB 18d)
  const bnbStr = needWBNB ? fmt(needWBNB, 18) : "-";
  const usdtStr = needUSDT ? fmt(needUSDT, 18) : "-";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold mb-2">Compute Required Amounts</h3>
      <p className="text-xs text-slate-400 mb-3">
        Pull live prices and mirror contract math. Run this before funding. Amounts use ceiling rounding to
        avoid underfunding.
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={computeNeeds}
          disabled={computing || !canCompute}
          className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm disabled:opacity-50"
        >
          {computing ? "Computing…" : "Compute"}
        </button>

        {!canCompute && (
          <span className="text-[11px] text-amber-300/90">
            Missing: {missing.join(", ")}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300">
            Need <b>BNB (native)</b> for A:
          </span>
          <div className="flex items-center gap-2">
            <code className="text-slate-200">{bnbStr}</code>
            <CopyBtn value={bnbStr} label="BNB amount" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300">
            Need <b>USDT (BSC)</b> for B:
          </span>
          <div className="flex items-center gap-2">
            <code className="text-slate-200">{usdtStr}</code>
            <CopyBtn value={usdtStr} label="USDT amount" />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Note: Although funding is with <b>native BNB</b>, the math uses the <b>WBNB</b> token’s 18 decimals internally.
        </p>
      </div>
    </div>
  );
}
