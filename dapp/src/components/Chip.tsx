// src/components/Chip.tsx
import React from "react";
export default function Chip({ ok = true, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] ring-1 transition ${ok ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20" : "bg-slate-700/40 text-slate-200 ring-white/10"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-400"}`} /> {label}
    </span>
  );
}
