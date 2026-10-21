"use client";

import { useState } from "react";

import { StallMapLoader } from "@/components/map/MapLoaders";
import { bestArea } from "@/lib/areas";
import { canPark, permitLabels } from "@/lib/permits";
import type {
  Garage,
  Level,
  LevelCounts,
  Permit,
  Stall,
  StallStatus,
} from "@/types/parking";

type StallPanelProps = {
  garage: Garage;
  level: Level;
  counts: LevelCounts | null;
  stalls: Record<string, StallStatus>;
  permit: Permit;
  highContrast: boolean;
};

function Legend({ highContrast }: { highContrast: boolean }) {
  const open = highContrast ? "bg-yellow-400 border-black border-2" : "bg-emerald-500 border-emerald-700";
  const taken = highContrast ? "stall-swatch-taken-hc" : "stall-swatch-taken";

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      <li className="flex items-center gap-1.5">
        <span className={`h-3.5 w-3.5 rounded-sm border ${open}`} />
        Open
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`h-3.5 w-3.5 rounded-sm border border-slate-700 ${taken}`} />
        Taken
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-sm border border-dashed border-slate-400 bg-white" />
        Not your permit
      </li>
    </ul>
  );
}

function CountsOnly({ garage, counts }: { garage: Garage; counts: LevelCounts | null }) {
  const rows: [string, keyof LevelCounts][] = [
    ["Student", "student"],
    ["Staff", "staff"],
    ["Other (ADA, EV, pay, motorcycle)", "other"],
  ];

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">
        Stall-by-stall map coming soon for {garage.shortName}.
      </p>
      <p className="mt-1 text-sm text-slate-500">Open spots on this level by type:</p>

      <dl className="mt-3 divide-y divide-slate-200 text-sm">
        {rows.map(([label, key]) =>
          counts && counts[key].total > 0 ? (
            <div key={key} className="flex justify-between py-2">
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-bold tabular-nums text-slate-900">
                {counts[key].open}{" "}
                <span className="font-normal text-slate-500">/ {counts[key].total}</span>
              </dd>
            </div>
          ) : null
        )}
      </dl>
    </div>
  );
}

export default function StallPanel({
  garage,
  level,
  counts,
  stalls,
  permit,
  highContrast,
}: StallPanelProps) {
  const [selected, setSelected] = useState<Stall | null>(null);
  const selectedHere =
    selected && level.stalls?.some((stall) => stall.id === selected.id) ? selected : null;

  if (!level.stalls || !garage.viewBox) {
    return (
      <section aria-label={`${level.name} detail`}>
        <CountsOnly garage={garage} counts={counts} />
      </section>
    );
  }

  const hint = bestArea(level, garage.viewBox, stalls, permit);

  return (
    <section
      aria-label={`${level.name} stall map`}
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-base font-bold text-slate-950">
          {garage.shortName} · {level.name}
        </h2>
        <Legend highContrast={highContrast} />
      </div>

      <p className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
        {hint ? (
          <>
            Head to the <span className="font-bold">{hint.area}</span> area (rows{" "}
            {hint.rows.join(", ")}): <span className="font-bold">{hint.open} open</span> for you.
          </>
        ) : (
          <>No open {permit === "all" ? "" : `${permitLabels[permit].toLowerCase()} `}spots on this level.</>
        )}
      </p>

      <div
        className={`mt-3 h-[440px] overflow-hidden rounded-xl border border-slate-200 sm:h-[560px] lg:h-[640px] ${
          highContrast ? "stall-map-hc" : ""
        }`}
      >
        <StallMapLoader
          garageId={garage.id}
          level={level}
          viewBox={garage.viewBox}
          stalls={stalls}
          permit={permit}
          highContrast={highContrast}
          selectedStallId={selectedHere?.id ?? null}
          onSelectStall={setSelected}
        />
      </div>

      <div className="mt-3 min-h-14 rounded-xl bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
        {selectedHere ? (
          <p>
            <span className="font-bold">Stall {selectedHere.id}</span> · {selectedHere.type} ·{" "}
            <span className="font-semibold">
              {stalls[selectedHere.id] === "open" ? "Open" : "Taken"}
            </span>
            <br />
            <span className="text-slate-500">
              {canPark(permit, selectedHere.type)
                ? "You can park here."
                : `Not available with a ${permitLabels[permit]} permit.`}
            </span>
          </p>
        ) : (
          <p className="text-slate-500">Tap a stall to see its type and status.</p>
        )}
      </div>
    </section>
  );
}
