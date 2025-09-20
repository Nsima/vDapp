// src/components/AddressForm.tsx
import React from "react";
import Input from "./Input";

export default function AddressForm({
  escrowAddr, setEscrowAddr,
  usdtAddr, setUsdtAddr,
  wbnbAddr, setWbnbAddr,
  bnbUsdFeed, setBnbUsdFeed,
  usdtUsdFeed, setUsdtUsdFeed,
  loadFromEscrow, copyShare, copied, escrow
}: any) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-3">
        <Input label="Escrow address" value={escrowAddr} onChange={setEscrowAddr} placeholder="0x... (UsdEscrow_BNB_USDT)" />
        <Input label="USDT address (mock)" value={usdtAddr} onChange={setUsdtAddr} placeholder="0x... (MockERC20Dec)" />
        <Input label="WBNB address (mock)" value={wbnbAddr} onChange={setWbnbAddr} placeholder="0x... (WrappedNativeMock)" />
        <Input label="BNB/USD feed" value={bnbUsdFeed} onChange={setBnbUsdFeed} placeholder="0x... (PriceFeedMock)" />
        <Input label="USDT/USD feed" value={usdtUsdFeed} onChange={setUsdtUsdFeed} placeholder="0x... (PriceFeedMock)" />
      </div>
      <div className="flex flex-wrap items-center gap-3 -mt-1">
        <button onClick={loadFromEscrow} disabled={!escrow} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs disabled:opacity-50">
          Auto-fill from Escrow
        </button>
        <button onClick={copyShare} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs">
          {copied ? "Link Copied!" : "Copy Share Link"}
        </button>
        <span className="text-[11px] text-slate-500">Shareable URL includes escrow, deal, and contract addresses. Party B can open and just “Approve + Fund”.</span>
      </div>
    </>
  );
}
