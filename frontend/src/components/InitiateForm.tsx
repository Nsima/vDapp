// src/components/InitiateForm.tsx
import React from "react";
import Input from "./Input";

export default function InitiateForm({
  partyB, setPartyB,
  usdAmount, setUsdAmount,
  deadlineHrs, setDeadlineHrs,
  unwrapToBNB, setUnwrapToBNB,
  onInitiate, creating, dealId
}: any) {
  return (
    <>
      <h2 className="text-sm font-semibold text-slate-300">Initiate Escrow</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <Input label="Party B address" value={partyB} onChange={setPartyB} placeholder="0x... (the counterparty)" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="$ Amount (each side)" type="number" value={String(usdAmount)} onChange={(v)=> setUsdAmount(Number(v || 0))} placeholder="20" />
          <Input label="Deadline (hours)" type="number" value={String(deadlineHrs)} onChange={(v)=> setDeadlineHrs(Number(v || 0))} placeholder="72" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm mt-1">
        <input type="checkbox" checked={unwrapToBNB} onChange={(e)=> setUnwrapToBNB(e.target.checked)} />
        Payout B in native BNB (unwrap)
      </label>
      <div className="flex items-center gap-3">
        <button onClick={onInitiate} className="rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-50">
          {creating ? "Creating…" : "Initiate Escrow"}
        </button>
        {dealId !== null && <span className="text-xs text-slate-300">Deal ID: <b>#{dealId}</b></span>}
      </div>
    </>
  );
}
