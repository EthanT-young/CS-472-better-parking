"use client";

import SiteSelector from "@/components/controls/SiteSelector";
import LotSelector from "@/components/controls/LotSelector";
import FloorSelector from "@/components/controls/FloorSelector";

import type {
  Site,
  Lot,
  Floor,
} from "@/types/parking";

interface ParkingSearchProps {
  sites: Site[];
  lots: Lot[];
  floors: Floor[];

  selectedSite: number;
  selectedLot: number;
  selectedFloor: number;

  onSiteChange: (siteId: number) => void;
  onLotChange: (lotId: number) => void;
  onFloorChange: (floorNumber: number) => void;
  onFindParking: () => void;
}

export default function ParkingSearch({
  sites,
  lots,
  floors,
  selectedSite,
  selectedLot,
  selectedFloor,
  onSiteChange,
  onLotChange,
  onFloorChange,
  onFindParking,
}: ParkingSearchProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <SiteSelector
          sites={sites}
          value={selectedSite}
          onChange={onSiteChange}
        />

        <LotSelector
          lots={lots}
          value={selectedLot}
          onChange={onLotChange}
        />

        <FloorSelector
          floors={floors}
          value={selectedFloor}
          onChange={onFloorChange}
        />
      </div>

      <button
        type="button"
        onClick={onFindParking}
        disabled={
          selectedLot === 0 ||
          selectedFloor === 0
        }
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-red-500 px-5 font-semibold text-white transition hover:bg-red-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Find Parking
      </button>
    </section>
  );
}
