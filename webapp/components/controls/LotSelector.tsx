import type { Lot } from "@/types/parking";

interface LotSelectorProps {
  lots: Lot[];
  value: number;
  onChange: (lotId: number) => void;
}

export default function LotSelector({
  lots,
  value,
  onChange,
}: LotSelectorProps) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Garage
      </span>

      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={lots.length === 0}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {lots.length === 0 ? (
          <option value={0}>No garages available</option>
        ) : (
          lots.map((lot) => (
            <option key={lot.lot_id} value={lot.lot_id}>
              {lot.lot_name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}