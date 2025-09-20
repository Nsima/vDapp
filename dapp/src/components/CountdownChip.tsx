import React from "react";

function formatDuration(sec: number) {
  const d = Math.floor(sec / 86400);
  sec %= 86400;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return (d > 0 ? `${d}d ` : "") + `${hh}:${mm}:${ss}`;
}

export default function CountdownChip({ seconds }: { seconds: number | null }) {
  const expired = seconds !== null && seconds <= 0;
  const low = seconds !== null && seconds > 0 && seconds <= 300; // < 5 min
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] ring-1";
  const tone = expired
    ? "bg-rose-500/15 text-rose-200 ring-rose-400/30"
    : low
    ? "bg-amber-500/15 text-amber-200 ring-amber-400/30"
    : "bg-slate-700/40 text-slate-200 ring-white/10";

  return (
    <span className={`${base} ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
      ⏳ {seconds === null ? "—" : expired ? "Expired" : formatDuration(seconds)}
    </span>
  );
}
