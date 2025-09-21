import React, { useMemo, useState } from "react";
import { ethers } from "ethers";
import escrowAbi from "../../abi/escrow.json";

type Props = {
  escrowAddr?: string;
  chainId?: number | null;
};

function explorerFor(chainId?: number | null) {
  switch (chainId) {
    case 1:   return "https://etherscan.io/address/";
    case 5:   return "https://goerli.etherscan.io/address/";
    case 11155111: return "https://sepolia.etherscan.io/address/";
    case 56:  return "https://bscscan.com/address/";
    case 97:  return "https://testnet.bscscan.com/address/";
    default:  return null; // localhost or unknown
  }
}

export default function AbiPanel({ escrowAddr, chainId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const abiStr = useMemo(() => JSON.stringify(escrowAbi, null, 2), []);
  const abiHash = useMemo(() => ethers.id(abiStr), [abiStr]);
  const explorer = explorerFor(chainId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(abiStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const download = () => {
    const blob = new Blob([abiStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "escrow.abi.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-white/10">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="font-semibold">Dev / ABI</span>
          <span className="text-[10px] text-slate-500">hash:</span>
          <code className="text-[10px] text-slate-400">{abiHash.slice(0,10)}…{abiHash.slice(-6)}</code>
          {escrowAddr && explorer && (
            <a
              className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              href={`${explorer}${escrowAddr}`}
              target="_blank" rel="noreferrer"
            >
              View on Explorer
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px]">
            {copied ? "Copied ✓" : "Copy ABI"}
          </button>
          <button onClick={download} className="rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px]">
            Download
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-[11px]"
          >
            {open ? "Hide ABI" : "Show ABI"}
          </button>
        </div>
      </div>

      {open && (
        <pre className="max-h-72 overflow-auto bg-slate-900/60 p-3 text-[11px] leading-[1.35] text-slate-200">
{abiStr}
        </pre>
      )}
    </div>
  );
}
