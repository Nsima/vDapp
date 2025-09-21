// src/components/Input.tsx
import React from "react";
export default function Input({
  label, value, onChange, placeholder, type = "text"
}: { label: string; value: string; onChange: (v: string)=>void; placeholder?: string; type?: string; }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        value={value}
        onChange={(e)=> onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}
