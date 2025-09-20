// src/components/RoleBadge.tsx
import React from "react";
export default function RoleBadge({ role }: { role: 'Party A' | 'Party B' | 'Observer' | 'Unknown' | string }) {
  const styles = role === 'Party A'
    ? 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/30'
    : role === 'Party B'
    ? 'bg-sky-500/15 text-sky-200 ring-sky-400/30'
    : role === 'Observer'
    ? 'bg-slate-600/20 text-slate-200 ring-white/10'
    : 'bg-amber-500/15 text-amber-200 ring-amber-400/30';
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 ${styles}`}>
      <span className="h-2 w-2 rounded-full bg-current/70" />
      <span>Role: <b>{role}</b></span>
      <span className="text-xs text-white/60 ml-1">{role === 'Unknown' ? 'Connect wallet to determine' : role === 'Observer' ? 'Address does not match A or B' : ''}</span>
    </div>
  );
}
