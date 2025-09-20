// src/components/ComputePanel.tsx
import React from "react";

export default function ComputePanel({
  computeNeeds, computing, needWBNB, needUSDT, feedBNB, feedUSDT, usdt, wbnb, fmt
}: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold mb-3">Compute Required Amounts</h3>
      <p className="text-xs text-slate-400 mb-3">Read feeds to mirror contract math. Run before funding.</p>
      <button
        onClick={computeNeeds}
        disabled={computing || !(feedBNB && feedUSDT && usdt && wbnb)}
        className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm disabled:opacity-50"
      >
        {computing ? "Computing…" : "Compute"}
      </button>

      <div className="mt-3 text-sm">
        <p>Need WBNB for A: <b>{needWBNB ? fmt(needWBNB, 18) : "-"}</b></p>
        <p>Need USDT for B: <b>{needUSDT ? fmt(needUSDT, 18) : "-"}</b></p>
      </div>
    </div>
  );
}
