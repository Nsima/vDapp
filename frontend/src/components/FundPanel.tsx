import React from "react";

export default function FundPanel({
  role, fundA, fundB, dealId, needWBNB, needUSDT, fundingA, fundingB, partyAOnchain, partyBOnchain, short, isExpired
}: {
  role: string;
  fundA: () => void;
  fundB: () => void;
  dealId: number | null;
  needWBNB: bigint | null;
  needUSDT: bigint | null;
  fundingA: boolean;
  fundingB: boolean;
  partyAOnchain: string;
  partyBOnchain: string;
  short: (addr?: string) => string;
  isExpired?: boolean; // 👈 NEW
}) {
  const expired = !!isExpired;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold mb-3">Fund Actions</h3>

      {expired && (
        <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Funding window has expired.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        {role === 'Party A' && (
          <button
            onClick={fundA}
            disabled={expired || dealId === null || needWBNB === null || fundingA}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm disabled:opacity-50"
          >
            {fundingA ? "Funding A…" : "Fund as A (send BNB)"}
          </button>
        )}

        {role === 'Party B' && (
          <button
            onClick={fundB}
            disabled={expired || dealId === null || needUSDT === null || fundingB}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm disabled:opacity-50"
          >
            {fundingB ? "Funding B…" : "Approve + Fund as B (USDT)"}
          </button>
        )}

        {role !== 'Party A' && role !== 'Party B' && (
          <div className="text-xs text-slate-400 space-y-1">
            <div>To fund as A, switch to {partyAOnchain ? short(partyAOnchain) : 'Party A'}.</div>
            <div>To fund as B, switch to {partyBOnchain ? short(partyBOnchain) : 'Party B'}.</div>
          </div>
        )}
      </div>
    </div>
  );
}