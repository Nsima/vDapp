import React from "react";

export default function Header({ onLocal, chainId, activeStep }: { onLocal: boolean; chainId: number | null; activeStep: number }) {
  const Step = ({ n, label }: { n: number; label: string }) => (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 text-[12px] ${activeStep >= n ? "ring-indigo-400/40 bg-indigo-400/10 text-indigo-200" : "ring-white/10 bg-white/5 text-slate-300"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${activeStep >= n ? "bg-indigo-400" : "bg-slate-400"}`} /> {label}
    </span>
  );
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/20 backdrop-blur-sm flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3m0-14l-3 3M8 16l-3 3"/></svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">
              VesselWallet Escrow dApp
            </span>
          </h1>
          <p className="text-[12px] text-slate-400">Ethereum Mainnet · Step {activeStep} of 4</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
        <Step n={1} label="Connect" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={2} label="Initiate" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={3} label="Fund" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={4} label="Complete" />
        <div className="h-[1px] w-6 bg-white/10" />
        <span className={`px-2 py-1 rounded-md ${onLocal ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>
          {onLocal ? "Ethereum Mainnet" : `chain ${chainId}`}
        </span>
      </div>
    </header>
  );
}
