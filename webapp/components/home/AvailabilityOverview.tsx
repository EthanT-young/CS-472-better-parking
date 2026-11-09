interface AvailabilityOverviewProps {
  available: number | null;
  total: number | null;
}

export default function AvailabilityOverview({
  available,
  total,
}: AvailabilityOverviewProps) {
  const hasData =
    available !== null &&
    total !== null &&
    total > 0;

  if (!hasData) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500">
            ?
          </div>

          <div>
            <h2 className="font-bold text-slate-900">
              Parking availability unavailable
            </h2>

            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              We don&apos;t currently have parking
              information for this level. Try another
              floor or check back later.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const occupied =
    total - available;

  const occupancy =
    Math.round(
      (occupied / total) * 100
    );

  let status = "Plenty available";
  let statusClasses =
    "bg-emerald-100 text-emerald-700";

  if (occupancy >= 100) {
    status = "Full";
    statusClasses =
      "bg-red-100 text-red-700";
  } else if (occupancy >= 90) {
    status = "Nearly full";
    statusClasses =
      "bg-red-100 text-red-700";
  } else if (occupancy >= 70) {
    status = "Filling up";
    statusClasses =
      "bg-amber-100 text-amber-700";
  }

  const progressClasses =
    occupancy >= 90
      ? "bg-red-500"
      : occupancy >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          Spaces Available
        </p>

        <p
          className={`mt-2 text-4xl font-extrabold ${
            available === 0
              ? "text-red-600"
              : "text-emerald-600"
          }`}
        >
          {available}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          of {total} total spaces
        </p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Garage Occupancy
            </p>

            <p className="mt-2 text-3xl font-extrabold">
              {occupancy}%
            </p>

            <p className="text-sm text-slate-500">
              full
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses}`}
          >
            {status}
          </span>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressClasses}`}
            style={{
              width: `${occupancy}%`,
            }}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>
            {occupied} occupied
          </span>

          <span>
            {available} available
          </span>
        </div>
      </article>
    </div>
  );
}
