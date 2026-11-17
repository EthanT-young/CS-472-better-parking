import ParkingMap from "@/components/parking/ParkingMap";

import type {
  Floor,
  Section,
} from "@/types/parking";

interface GaragePreviewProps {
  garageName: string;
  selectedFloor: number;
  floors: Floor[];
  sections: Section[];
  onFloorChange: (floorNumber: number) => void;
}

export default function GaragePreview({
  garageName,
  selectedFloor,
  floors,
  sections,
  onFloorChange,
}: GaragePreviewProps) {
  /*
   * Sections that belong to the currently selected floor.
   */
  const selectedSections = sections.filter(
    (section) =>
      section.floor_num === selectedFloor
  );

  /*
   * The floor can exist without having section data.
   *
   * Example:
   * Level 5 exists in `floors`,
   * but has no rows in `sections`.
   *
   * That means "data unavailable",
   * NOT "0 spaces available".
   */
  const hasData =
    selectedSections.length > 0;

  /*
   * Calculate available spaces for an individual
   * floor. Used by the floor cards below the map.
   */
  function getFloorAvailability(
    floorNumber: number
  ): number | null {
    const floorSections = sections.filter(
      (section) =>
        section.floor_num === floorNumber
    );

    if (floorSections.length === 0) {
      return null;
    }

    return floorSections.reduce(
      (sum, section) =>
        sum + section.open_spaces,
      0
    );
  }

  /*
   * Calculate totals for the selected floor.
   */
  const availableSpaces = hasData
    ? selectedSections.reduce(
        (sum, section) =>
          sum + section.open_spaces,
        0
      )
    : null;

  const totalSpaces = hasData
    ? selectedSections.reduce(
        (sum, section) =>
          sum + section.total_spaces,
        0
      )
    : null;

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden scroll-mt-24 rounded-3xl border border-slate-200 bg-slate-100 p-3 shadow-lg sm:p-4">
      <div className="w-full min-w-0 max-w-full rounded-2xl bg-white p-4 sm:p-5">

        {/* Garage header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
              {garageName}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Level {selectedFloor}
            </p>
          </div>

          {hasData ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              Live
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              No data
            </span>
          )}
        </div>

        {/* Map */}
        <div className="relative mt-4 w-full min-w-0 max-w-full aspect-4/3 min-h-70 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:min-h-90 xl:aspect-auto xl:h-107.5">

          <ParkingMap />

          {/* Current floor label */}
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Current Level
            </p>

            <p className="mt-0.5 text-sm font-bold text-slate-950">
              Level {selectedFloor}
            </p>
          </div>

          {/* Live data summary */}
          {hasData &&
            availableSpaces !== null &&
            totalSpaces !== null && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold text-slate-500">
                  Spaces Available
                </p>

                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-extrabold ${
                      availableSpaces === 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {availableSpaces}
                  </span>

                  <span className="text-xs text-slate-500">
                    / {totalSpaces}
                  </span>
                </div>
              </div>
            )}

          {/* No live occupancy data */}
          {!hasData && (
            <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:left-auto sm:max-w-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                  ?
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Availability unavailable
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    The map is available, but we
                    don&apos;t currently have parking
                    information for Level{" "}
                    {selectedFloor}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floor selector */}
        <div className="mt-4 w-full min-w-0 max-w-full">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Garage Levels
          </p>

          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <div className="flex w-full max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-2">
              {floors.map((floor) => {
                const available =
                  getFloorAvailability(
                    floor.floor_num
                  );

                const selected =
                  floor.floor_num ===
                  selectedFloor;

                return (
                  <button
                    type="button"
                    key={`${floor.lot_id}-${floor.floor_num}`}
                    onClick={() =>
                      onFloorChange(
                        floor.floor_num
                      )
                    }
                    aria-pressed={selected}
                    className={`w-28 shrink-0 rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-red-400 bg-red-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">
                      Level {floor.floor_num}
                    </span>

                    {available !== null ? (
                      <>
                        <span
                          className={`mt-2 block text-xl font-bold ${
                            available === 0
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {available}
                        </span>

                        <span className="text-xs text-slate-500">
                          {available === 1
                            ? "space free"
                            : "spaces free"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="mt-2 block text-xl font-bold text-slate-400">
                          —
                        </span>

                        <span className="text-xs font-medium text-slate-400">
                          No data
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
