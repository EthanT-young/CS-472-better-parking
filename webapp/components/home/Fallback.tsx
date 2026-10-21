import type { GarageOption } from "./GarageCards";

type FallbackProps = {
  option: GarageOption;
  onSelect: (garageId: string) => void;
};

// Shown when the chosen garage is nearly full, instead of leaving people to circle.
export default function Fallback({ option, onSelect }: FallbackProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.garage.id)}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-950 transition hover:bg-emerald-100"
    >
      <span>
        <span className="font-bold">Filling up here.</span> Try {option.garage.name}:{" "}
        <span className="font-bold tabular-nums">{option.open}</span> open for you.
      </span>
      <span aria-hidden="true" className="text-lg">
        →
      </span>
    </button>
  );
}
