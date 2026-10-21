"use client";

import { useState } from "react";

// Static example of the campus event alerts participants asked for.
export default function EventBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <span aria-hidden="true" className="mt-0.5 text-lg leading-none">
        ⚠
      </span>

      <p className="flex-1 text-sm leading-6">
        <span className="font-bold">Basketball tonight at Thomas &amp; Mack, 7 PM.</span>{" "}
        Expect garages near the arena to fill early this evening.
      </p>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-amber-900 hover:bg-amber-100"
      >
        ×
      </button>
    </div>
  );
}
