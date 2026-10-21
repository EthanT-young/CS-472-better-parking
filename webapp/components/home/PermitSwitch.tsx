import { permitLabels } from "@/lib/permits";
import type { Permit } from "@/types/parking";

type PermitSwitchProps = {
  value: Permit;
  onChange: (permit: Permit) => void;
};

const permits: Permit[] = ["student", "staff", "all"];

export default function PermitSwitch({ value, onChange }: PermitSwitchProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        I park as
      </legend>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1">
        {permits.map((permit) => (
          <button
            key={permit}
            type="button"
            onClick={() => onChange(permit)}
            aria-pressed={value === permit}
            className="min-h-11 rounded-lg text-sm font-semibold text-slate-600 transition aria-pressed:bg-white aria-pressed:text-slate-950 aria-pressed:shadow-sm"
          >
            {permitLabels[permit]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
