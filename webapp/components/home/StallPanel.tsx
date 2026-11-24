
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

// Swatches match the map's stall styles in components/map/StallMap.tsx.
function Legend({ highContrast }: { highContrast: boolean }) {
  const open = highContrast
    ? "bg-yellow-400 border-black border-2"
    : "bg-emerald-600 border-emerald-950";
  const taken = highContrast ? "stall-swatch-taken-hc" : "stall-swatch-taken";

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-sm border ${open}`} />
        Open
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`h-3.5 w-3.5 rounded-sm border border-slate-700 ${taken}`}
        />
        Taken
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 rounded-sm border border-dashed border-slate-500 bg-white"
        />
        Not your permit
      </li>
    </ul>
  );
}

// Provides a complete HTML alternative to the interactive Leaflet map.
// Users can inspect and select every parking stall using keyboard controls.
// Supports WCAG 1.1.1, 1.3.1, 2.1.1, and 4.1.2.
function AllStallList({
  level,
  stalls,
  permit,
  selectedId,
  onSelect,
}: {
  level: Level;
  stalls: Record<string, StallStatus>;
  permit: Permit;
  selectedId: string | null;
  onSelect: (stall: Stall) => void;
}) {
  const rows = new Map<string, Stall[]>();
  for (const stall of level.stalls ?? []) {
    rows.set(stall.strip, [...(rows.get(stall.strip) ?? []), stall]);
  }

  const sorted = [...rows.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const count = sorted.reduce((sum, [, row]) => sum + row.length, 0);

  return (
    <details className="mt-3 rounded-xl border border-slate-300 bg-white">
      <summary
        id={`stall-list-${level.id}`}
        className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm font-semibold text-slate-900"
      >
        Browse all stalls ({count})
      </summary>

      {count === 0 ? (
        <p className="px-3 pb-3 text-sm text-slate-600">
          No parking stalls are mapped for this level.
        </p>
      ) : (
        <div className="max-h-72 space-y-3 overflow-y-auto px-3 pb-3">
          {sorted.map(([strip, row]) => (
            <div key={strip} role="group" aria-labelledby={`row-${level.id}-${strip}`}>
              <p
                id={`row-${level.id}-${strip}`}
                className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Row {strip}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {row.map((stall) => (
                  <button
                    key={stall.id}
                    type="button"
                    onClick={() => onSelect(stall)}
                    aria-pressed={stall.id === selectedId}
                    className="min-h-8 min-w-8 rounded-md border border-slate-500 px-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
                  >
                    Stall {stall.id} · {stall.type} ·{" "}
                    {stalls[stall.id] === "open"
                      ? "Open"
                      : stalls[stall.id] === "taken"
                        ? "Taken"
                        : "Status unavailable"}
                    {!canPark(permit, stall.type) && (
                      <span> · Outside selected parking filter</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
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
      <p className="mt-1 text-sm text-slate-600">Open spots on this level by type:</p>

      <dl className="mt-3 divide-y divide-slate-200 text-sm">
        {rows.map(([label, key]) =>
          counts && counts[key].total > 0 ? (
            <div key={key} className="flex justify-between py-2">
              <dt className="text-slate-700">{label}</dt>
              <dd className="font-bold tabular-nums text-slate-900">
                {counts[key].open}{" "}
                <span className="font-normal text-slate-600">/ {counts[key].total}</span>
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
  const [selected, setSelected] = useState<{
    garageId: string;
    levelId: string;
    stallId: string;
  } | null>(null);

  const selectedHere =
    selected?.garageId === garage.id && selected?.levelId === level.id
      ? level.stalls?.find((stall) => stall.id === selected.stallId) ?? null
      : null;

  function handleSelectStall(stall: Stall) {
    setSelected({
      garageId: garage.id,
      levelId: level.id,
      stallId: stall.id,
    });
  }

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
          <>
            No open {permit === "all" ? "" : `${permitLabels[permit].toLowerCase()} `}
            spots on this level.
          </>
        )}
      </p>

      <a
        href={`#stall-list-${level.id}`}
        className="mt-3 inline-block self-start rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 underline focus-visible:outline-2"
      >
        Skip interactive map and browse stalls as a list
      </a>

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
          onSelectStall={handleSelectStall}
        />
      </div>

      <div
        className="mt-3 min-h-14 rounded-xl bg-slate-50 px-3 py-2 text-sm"
        aria-live="polite"
      >
        {selectedHere ? (
          <p>
            <span className="font-bold">Stall {selectedHere.id}</span> · {selectedHere.type} ·{" "}
            <span className="font-semibold">
              {stalls[selectedHere.id] === "open"
                ? "Open"
                : stalls[selectedHere.id] === "taken"
                  ? "Taken"
                  : "Status unavailable"}
            </span>
            <br />
            <span className="text-slate-600">
              {canPark(permit, selectedHere.type)
                ? "This stall is included in your parking filter."
                : `Not included with the ${permitLabels[permit]} parking filter.`}
            </span>
          </p>
        ) : (
          <p className="text-slate-600">
            Select a stall on the map or choose one from the list below
            to view its type and occupancy status.
            Keyboard users can press Enter or Space to select a stall.
          </p>
        )}
      </div>

      <AllStallList
        level={level}
        stalls={stalls}
        permit={permit}
        selectedId={selectedHere?.id ?? null}
        onSelect={handleSelectStall}
      />
    </section>
  );
}
