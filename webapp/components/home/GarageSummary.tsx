import { availability } from "@/lib/permits";
import type { Garage, Permit } from "@/types/parking";

import { barClasses, numberClasses, percentFull, pillClasses } from "./tone";
import UpdatedIndicator from "./UpdatedIndicator";

type GarageSummaryProps = {
  garage: Garage;
  permit: Permit;
  open: number;
  total: number;
  carsInGarage: number;
  carsLastMinute: number | null;
  updatedAt: number | null;
};

function fillRateText(cars: number | null) {
  if (cars === null) return "Measuring…";
  if (cars === 0) return "Steady";
  return `${cars > 0 ? "+" : "−"}${Math.abs(cars)} cars`;
}

export default function GarageSummary({
  garage,
  permit,
  open,
  total,
  carsInGarage,
  carsLastMinute,
  updatedAt,
}: GarageSummaryProps) {
  const status = availability(open, total);
  const full = percentFull(open, total);
  const spotsFor =
    permit === "all"
      ? "open spots"
      : `open spots for ${permit === "student" ? "students" : "staff"}`;

  return (
    <section
      aria-label={`${garage.name} summary`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-950">{garage.name}</h2>
        <UpdatedIndicator updatedAt={updatedAt} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p>
          <span
            className={`block text-6xl font-extrabold leading-none tabular-nums ${numberClasses[status.tone]}`}
          >
            {open}
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            {spotsFor} of {total}
          </span>
        </p>

        <div className="text-right">
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${pillClasses[status.tone]}`}
          >
            {status.label}
          </span>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
            {full}% <span className="text-sm font-semibold text-slate-500">full</span>
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`${full}% full`}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClasses[status.tone]}`}
          style={{ width: `${full}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500">Cars in {garage.kind === "lot" ? "lots" : "garage"}</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
            {carsInGarage.toLocaleString()}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500">Fill rate, last minute</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
            {fillRateText(carsLastMinute)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
