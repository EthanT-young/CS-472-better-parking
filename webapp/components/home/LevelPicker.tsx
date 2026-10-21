import { availability } from "@/lib/permits";
import type { Level } from "@/types/parking";

import { barClasses, numberClasses, percentFull } from "./tone";

export type LevelOption = {
  level: Level;
  open: number;
  total: number;
};

type LevelPickerProps = {
  options: LevelOption[];
  selectedLevelId: string;
  onSelect: (levelId: string) => void;
};

export default function LevelPicker({
  options,
  selectedLevelId,
  onSelect,
}: LevelPickerProps) {
  const mostOpen = options.reduce<LevelOption | null>(
    (best, option) => (!best || option.open > best.open ? option : best),
    null
  );

  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Pick a level
      </h2>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {options.map((option) => {
          const { level, open, total } = option;
          const status = availability(open, total);
          const best = mostOpen?.level.id === level.id && open > 0 && options.length > 1;

          return (
            <button
              key={level.id}
              type="button"
              onClick={() => onSelect(level.id)}
              aria-pressed={level.id === selectedLevelId}
              aria-label={`${level.name}: ${open} of ${total} open, ${status.label}${best ? ", most open" : ""}`}
              className="relative flex min-h-20 flex-col rounded-xl border-2 border-slate-200 bg-white p-2.5 text-left transition hover:border-slate-300 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
            >
              <span className="text-xs font-semibold opacity-80">
                {level.name.replace("Level ", "L")}
                {best && (
                  <span className="ml-1 rounded bg-emerald-600 px-1 py-px text-[10px] font-bold uppercase text-white">
                    Most open
                  </span>
                )}
              </span>
              <span
                className={`mt-1 text-2xl font-extrabold tabular-nums ${
                  level.id === selectedLevelId ? "" : numberClasses[status.tone]
                }`}
              >
                {open}
              </span>
              <span className="mt-auto h-1.5 overflow-hidden rounded-full bg-slate-200">
                <span
                  className={`block h-full ${barClasses[status.tone]}`}
                  style={{ width: `${percentFull(open, total)}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
