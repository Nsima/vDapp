import React from "react";

type Props = {
  onLocal?: boolean;
  chainId?: number | null;
  activeStep?: number; 
  title?: string;    
  logoSrc?: string;    
  logoAlt?: string;   
};

const steps = ["Connect", "Create/Join", "Fund/Settle", "Complete"];

export default function Header({
  onLocal,
  chainId,
  activeStep = 1,
  title = "Vessel Escrow",
  logoSrc = "/logo.svg",
  logoAlt = "Logo",
}: Props) {
  const netLabel =
    chainId == null ? "Network: Unknown"
    : onLocal ? "Network: Localhost"
    : `Chain ID: ${chainId}`;

  return (
    <header className="flex flex-col gap-3">
      {/* Brand row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt || "Logo"}
              className="h-8 w-8 rounded-lg ring-1 ring-white/10 object-contain bg-white/5"
              onError={(e) => {
                // if image is missing, fall back to emoji
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <h1 className="text-lg font-semibold tracking-tight text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-800/70 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
            {netLabel}
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const idx = i + 1;
          const isActive = idx === activeStep;
          const isDone = idx < activeStep;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={[
                  "h-6 min-w-6 rounded-full px-2 text-[11px] grid place-items-center",
                  isDone
                    ? "bg-emerald-600/70 text-white ring-1 ring-emerald-300/30"
                    : isActive
                    ? "bg-indigo-600/80 text-white ring-1 ring-indigo-300/30"
                    : "bg-slate-800/70 text-slate-300 ring-1 ring-white/10",
                ].join(" ")}
                title={s}
              >
                {idx}
              </div>
              <span className="text-[11px] text-slate-300">{s}</span>
              {i < steps.length - 1 && (
                <span className="mx-1 h-px w-6 bg-white/10" />
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}
