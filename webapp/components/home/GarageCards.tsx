import { availability } from "@/lib/permits";
import type { Garage } from "@/types/parking";

import { numberClasses, pillClasses } from "./tone";

export type GarageOption = {
  garage: Garage;
  open: number;
  total: number;
};

type GarageCardsProps = {
  options: GarageOption[];
  selectedGarageId: string;
  onSelect: (garageId: string) => void;
};

export default function GarageCards({
  options,
  selectedGarageId,
  onSelect,
}: GarageCardsProps) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Where to park
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {options.map(({ garage, open, total }) => {
          const status = availability(open, total);
          const selected = garage.id === selectedGarageId;

          return (
            <button
              key={garage.id}
              type="button"
              onClick={() => onSelect(garage.id)}
              aria-pressed={selected}
              className="flex min-h-28 flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 aria-pressed:border-red-500 aria-pressed:bg-red-50/40"
            >
              <span className="text-sm font-bold leading-tight text-slate-900">
                {garage.shortName}
              </span>

              <span>
                <span
                  className={`block text-3xl font-extrabold tabular-nums ${numberClasses[status.tone]}`}
                >
                  {open}
                </span>
                <span className="block text-xs text-slate-500">open for you</span>
              </span>

              <span
                className={`mt-2 inline-block self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${pillClasses[status.tone]}`}
              >
                {status.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
