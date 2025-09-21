import React from "react";
import Info from "./Info";

export default function ConnectCard({
  connected, onConnect, account, chainId, onLocal, error
}: {
  connected: boolean; onConnect: ()=>void; account: string; chainId: number | null; onLocal: boolean; error: string;
}) {
  return (
    <div className="mt-8 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6">
        {!connected ? (
          <div className="grid gap-5">
            <div className="text-sm text-slate-300">Connect MetaMask to get started</div>
            <button onClick={onConnect} className="group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] hover:shadow-[0_10px_38px_-10px_rgba(236,72,153,0.55)] transition-all active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12h12M12 6v12"/></svg>
              Connect Wallet
            </button>
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">{error}</div>}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] text-slate-400 font-medium mb-1">Tips</div>
              <ul className="text-[12px] text-slate-400 list-disc ml-5 space-y-1">
                <li>Listening to node: <code className="text-slate-300">Ethereum Mainnet</code></li>
                <li>MetaMask network: RPC <span className="text-slate-300">mainnet.infura.io</span> · Chain ID <span className="text-slate-300">1</span></li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Account" value={`${account.slice(0,6)}…${account.slice(-4)}`} />
              <Info label="Chain" value={onLocal ? "Ethereum Mainnet" : String(chainId)} highlight={onLocal} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
