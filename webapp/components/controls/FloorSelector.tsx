import type { Floor } from "@/types/parking";

interface FloorSelectorProps {
  floors: Floor[];
  value: number;
  onChange: (floorNumber: number) => void;
}

export default function FloorSelector({
  floors,
  value,
  onChange,
}: FloorSelectorProps) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Level
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        disabled={floors.length === 0}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {floors.length === 0 ? (
          <option value={0}>No levels available</option>
        ) : (
          floors.map((floor) => (
            <option
              key={`${floor.lot_id}-${floor.floor_num}`}
              value={floor.floor_num}
            >
              {floor.floor_num === 1
                ? "Level 1 (Ground)"
                : `Level ${floor.floor_num}`}
            </option>
          ))
        )}
      </select>
    </label>
  );
}