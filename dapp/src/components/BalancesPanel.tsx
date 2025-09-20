// src/components/BalancesPanel.tsx
import React from "react";

export default function BalancesPanel({
  partyAOnchain, partyBOnchain, bal, fmt, refreshBalances, ethers
}: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Balances</h3>
        <button onClick={refreshBalances} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">Refresh Balances</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-400 mb-1">Party A {partyAOnchain ? `(${partyAOnchain.slice(0,6)}…${partyAOnchain.slice(-4)})` : ""}</div>
          <div className="space-y-1">
            <div>USDT: <b>{bal.A_USDT !== undefined && bal.usdtD !== undefined ? fmt(bal.A_USDT, bal.usdtD) : "-"}</b></div>
            <div>WBNB: <b>{bal.A_WBNB !== undefined && bal.wbnbD !== undefined ? fmt(bal.A_WBNB, bal.wbnbD) : "-"}</b></div>
            <div>BNB:  <b>{bal.A_BNB !== undefined ? ethers.formatEther(bal.A_BNB) : "-"}</b></div>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">Party B {partyBOnchain ? `(${partyBOnchain.slice(0,6)}…${partyBOnchain.slice(-4)})` : ""}</div>
          <div className="space-y-1">
            <div>USDT: <b>{bal.B_USDT !== undefined && bal.usdtD !== undefined ? fmt(bal.B_USDT, bal.usdtD) : "-"}</b></div>
            <div>WBNB: <b>{bal.B_WBNB !== undefined && bal.wbnbD !== undefined ? fmt(bal.B_WBNB, bal.wbnbD) : "-"}</b></div>
            <div>BNB:  <b>{bal.B_BNB !== undefined ? ethers.formatEther(bal.B_BNB) : "-"}</b></div>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-500">After settlement: A should hold USDT, B should hold WBNB or native BNB depending on the unwrap toggle.</div>
    </div>
  );
}
