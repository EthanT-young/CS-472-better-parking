"use client";

import { useEffect, useState } from "react";

const STALE_AFTER_S = 30;

type UpdatedIndicatorProps = {
  updatedAt: number | null;
};

// The "last updated" trust signal: green while fresh, amber once stale. The dot doesn't
// pulse: a never-ending animation would need a pause control (WCAG 2.2.2).
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
    return <span className="text-xs text-slate-600">Connecting…</span>;
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
        stale ? "bg-amber-100 text-black" : "bg-emerald-100 text-black"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-2.5 w-2.5 rounded-full ${
          stale ? "bg-amber-700" : "bg-emerald-600"
        }`}
      />
      {stale ? `Not updated for ${age.replace(" ago", "")}` : `Updated ${age}`}
    </span>
  );
}
