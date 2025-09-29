import React from "react";

type Props = {
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
  isExpired?: boolean;          // from countdown
  settled?: boolean;            // new: whether contract is settled
  onRefundExpired?: () => void; // new: calls escrow.refundIfExpired(dealId)
};

export default function FundPanel({
  role,
  fundA,
  fundB,
  dealId,
  needWBNB,
  needUSDT,
  fundingA,
  fundingB,
  partyAOnchain,
  partyBOnchain,
  short,
  isExpired,
  settled,
  onRefundExpired,
}: Props) {
  const expired = !!isExpired;
  const isSettled = !!settled;

  const fundDisabledA = expired || isSettled || dealId === null || needWBNB === null || fundingA;
  const fundDisabledB = expired || isSettled || dealId === null || needUSDT === null || fundingB;

  // Show refund button only to A or B (UI restriction), when expired and not settled
  const canShowRefund =
    expired && !isSettled && (role === "Party A" || role === "Party B");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold mb-3">Fund Actions</h3>

      {expired && !isSettled && (
        <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Funding window has expired.
        </div>
      )}

      {isSettled && (
        <div className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          Deal settled — funds delivered to both parties.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        {role === "Party A" && (
          <button
            onClick={fundA}
            disabled={fundDisabledA}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm disabled:opacity-50"
          >
            {fundingA ? "Funding A…" : "Fund as A (send BNB)"}
          </button>
        )}

        {role === "Party B" && (
          <button
            onClick={fundB}
            disabled={fundDisabledB}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm disabled:opacity-50"
          >
            {fundingB ? "Funding B…" : "Approve + Fund as B (USDT)"}
          </button>
        )}

        {canShowRefund && (
          <button
            onClick={onRefundExpired}
            disabled={!onRefundExpired}
            className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-2 text-sm disabled:opacity-50"
            title="Refund escrowed funds back to original parties"
          >
            Refund (deal expired)
          </button>
        )}

        {role !== "Party A" && role !== "Party B" && (
          <div className="text-xs text-slate-400 space-y-1">
            <div>To fund as A, switch to {partyAOnchain ? short(partyAOnchain) : "Party A"}.</div>
            <div>To fund as B, switch to {partyBOnchain ? short(partyBOnchain) : "Party B"}.</div>
          </div>
        )}
      </div>
    </div>
  );
}
