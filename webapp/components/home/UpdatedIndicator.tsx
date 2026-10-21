"use client";

import { useEffect, useState } from "react";

const STALE_AFTER_S = 30;

type UpdatedIndicatorProps = {
  updatedAt: number | null;
};

// The "last updated" trust signal: green and pulsing while fresh, amber once stale.
export default function UpdatedIndicator({ updatedAt }: UpdatedIndicatorProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (updatedAt === null || now === null) {
    return <span className="text-xs text-slate-500">Connecting…</span>;
  }

  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  const stale = seconds > STALE_AFTER_S;
  const age =
    seconds < 5
      ? "just now"
      : seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds / 60)} min ago`;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
        stale ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"
      }`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {!stale && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            stale ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </span>
      {stale ? `Not updated for ${age.replace(" ago", "")}` : `Updated ${age}`}
    </span>
  );
}
