// src/components/Info.tsx
import React from "react";

export default function Info({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${highlight ? "ring-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "ring-white/10 bg-black/20"}`}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm tracking-tight">{value}</div>
    </div>
  );
}
