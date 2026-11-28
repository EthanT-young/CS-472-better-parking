// This component becomes the shared state/controller for the homepage.

"use client";

import { useMemo, useState } from "react";

import Hero from "@/components/home/Hero";
import ParkingSearch from "@/components/home/ParkingSearch";
import AvailabilityOverview from "@/components/home/AvailabilityOverview";
import GaragePreview from "@/components/home/GaragePreview";

import {
  sites,
  lots,
  floors,
  sections,
} from "@/data/mockParkingData";

export default function HomeParking() {
  const [selectedSite, setSelectedSite] = useState(
    sites[0]?.site_id ?? 0
  );

  const siteLots = useMemo(
    () =>
      lots.filter(
        (lot) => lot.site_id === selectedSite
      ),
    [selectedSite]
  );

  const [selectedLot, setSelectedLot] = useState(
    siteLots[0]?.lot_id ?? 0
  );

  const lotFloors = useMemo(
    () =>
      floors.filter(
        (floor) => floor.lot_id === selectedLot
      ),
    [selectedLot]
  );

  const [selectedFloor, setSelectedFloor] = useState(
    lotFloors[0]?.floor_num ?? 0
  );

  const selectedLotData = useMemo(
    () =>
      lots.find(
        (lot) => lot.lot_id === selectedLot
      ),
    [selectedLot]
  );

  const selectedSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          section.lot_id === selectedLot &&
          section.floor_num === selectedFloor
      ),
    [selectedLot, selectedFloor]
  );

  const lotSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          section.lot_id === selectedLot
      ),
    [selectedLot]
  );

  const hasData = selectedSections.length > 0;

  const totalSpaces = hasData
    ? selectedSections.reduce(
        (sum, section) =>
          sum + section.total_spaces,
        0
      )
    : null;

  const availableSpaces = hasData
    ? selectedSections.reduce(
        (sum, section) =>
          sum + section.open_spaces,
        0
      )
    : null;

  function handleSiteChange(siteId: number) {
    setSelectedSite(siteId);

    const nextLot = lots.find(
      (lot) => lot.site_id === siteId
    );

    if (!nextLot) {
      setSelectedLot(0);
      setSelectedFloor(0);
      return;
    }

    setSelectedLot(nextLot.lot_id);

    const nextFloor = floors.find(
      (floor) =>
        floor.lot_id === nextLot.lot_id
    );

    setSelectedFloor(
      nextFloor?.floor_num ?? 0
    );
  }

  function handleLotChange(lotId: number) {
    setSelectedLot(lotId);

    const nextFloor = floors.find(
      (floor) =>
        floor.lot_id === lotId
    );

    setSelectedFloor(
      nextFloor?.floor_num ?? 0
    );
  }

  function handleFindParking() {
    const preview =
      document.getElementById("garage-preview");

    preview?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (sites.length === 0) {
    return (
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <Hero />

          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
            <h2 className="text-xl font-bold">
              Parking information isn&apos;t available yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              No parking sites are currently available.
              Please check back later.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-16 xl:grid-cols-[minmax(0, 0.95fr)_minmax(0, 1.05fr)] xl:items-center xl:py-20">
        <div className="min-w-0">
          <Hero />

          <div className="mt-8">
            <ParkingSearch
              sites={sites}
              lots={siteLots}
              floors={lotFloors}
              selectedSite={selectedSite}
              selectedLot={selectedLot}
              selectedFloor={selectedFloor}
              onSiteChange={handleSiteChange}
              onLotChange={handleLotChange}
              onFloorChange={setSelectedFloor}
              onFindParking={handleFindParking}
            />
          </div>

          <div className="mt-6">
            <AvailabilityOverview
              available={availableSpaces}
              total={totalSpaces}
            />
          </div>
        </div>

        <div id="garage-preview" className="w-full min-w-0 max-w-full">
          <GaragePreview
            garageName={
              selectedLotData?.lot_name ??
              "No garage selected"
            }
            selectedFloor={selectedFloor}
            floors={lotFloors}
            sections={lotSections}
            onFloorChange={setSelectedFloor}
          />
        </div>
      </div>
    </section>
  );
}
