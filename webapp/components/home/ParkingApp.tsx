"use client";

import { useEffect, useMemo, useState } from "react";

import { CampusMapLoader } from "@/components/map/MapLoaders";
import StallPatterns from "@/components/map/StallPatterns";
import { garages } from "@/data/garages";
import { useLiveParking } from "@/lib/liveParking";
import { availability, eligibleCounts } from "@/lib/permits";
import type { Garage, Level, Permit } from "@/types/parking";

import EventBanner from "./EventBanner";
import Fallback from "./Fallback";
import Footer from "./Footer";
import GarageCards, { type GarageOption } from "./GarageCards";
import GarageSummary from "./GarageSummary";
import Header from "./Header";
import LevelPicker from "./LevelPicker";
import PermitSwitch from "./PermitSwitch";
import StallPanel from "./StallPanel";

const PERMIT_KEY = "unlv-parking:permit";
const CONTRAST_KEY = "unlv-parking:high-contrast";

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

export default function ParkingApp() {
  const live = useLiveParking();

  // The level with the most spots this permit can use.
  function bestLevel(garage: Garage, forPermit: Permit) {
    const openFor = (level: Level) => {
      const counts = live.levelCounts(level);
      return counts ? eligibleCounts(forPermit, counts).open : -1;
    };
    return garage.levels.reduce(
      (best, candidate) => (openFor(candidate) > openFor(best) ? candidate : best),
      garage.levels[0]
    );
  }

  const [permit, setPermit] = useState<Permit>("student");
  const [highContrast, setHighContrast] = useState(false);
  const [garageId, setGarageId] = useState(garages[0].id);
  const [levelId, setLevelId] = useState(() => bestLevel(garages[0], "student").id);

  // Restore remembered choices after hydration so server and client markup match.
  useEffect(() => {
    const storedPermit = readStored(PERMIT_KEY);
    const storedContrast = readStored(CONTRAST_KEY);
    const restore = window.setTimeout(() => {
      if (storedPermit === "student" || storedPermit === "staff" || storedPermit === "all") {
        setPermit(storedPermit);
      }
      setHighContrast(storedContrast === "true");
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  function changePermit(next: Permit) {
    setPermit(next);
    writeStored(PERMIT_KEY, next);
  }

  function toggleContrast() {
    setHighContrast((current) => {
      writeStored(CONTRAST_KEY, String(!current));
      return !current;
    });
  }

  const garage = garages.find((item) => item.id === garageId) ?? garages[0];
  const level = garage.levels.find((item) => item.id === levelId) ?? garage.levels[0];

  function selectGarage(nextGarageId: string) {
    const next = garages.find((item) => item.id === nextGarageId);
    if (!next) return;
    setGarageId(next.id);
    setLevelId(bestLevel(next, permit).id);
  }

  const garageOptions: GarageOption[] = useMemo(
    () =>
      garages.map((item) => ({
        garage: item,
        ...eligibleCounts(permit, live.garageCounts(item)),
      })),
    [live, permit]
  );

  const selectedOption =
    garageOptions.find((option) => option.garage.id === garage.id) ?? garageOptions[0];

  const levelOptions = garage.levels.map((item) => {
    const counts = live.levelCounts(item);
    return {
      level: item,
      ...(counts ? eligibleCounts(permit, counts) : { open: 0, total: 0 }),
    };
  });

  const allCounts = live.garageCounts(garage);
  const carsInGarage = Object.values(allCounts).reduce(
    (sum, group) => sum + group.total - group.open,
    0
  );

  const status = availability(selectedOption.open, selectedOption.total);
  const alternative =
    status.tone === "bad"
      ? garageOptions
          .filter((option) => option.garage.id !== garage.id)
          .sort((a, b) => b.open - a.open)[0]
      : undefined;

  return (
    <div className={`flex min-h-full flex-col bg-slate-100 ${highContrast ? "high-contrast" : ""}`}>
      <StallPatterns />
      <Header highContrast={highContrast} onToggleContrast={toggleContrast} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:py-6">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <EventBanner />
          <PermitSwitch value={permit} onChange={changePermit} />
          <GarageCards
            options={garageOptions}
            selectedGarageId={garage.id}
            onSelect={selectGarage}
          />
          <GarageSummary
            garage={garage}
            permit={permit}
            open={selectedOption.open}
            total={selectedOption.total}
            carsInGarage={carsInGarage}
            carsLastMinute={live.carsLastMinute(garage)}
            updatedAt={live.updatedAt}
          />
          {alternative && alternative.open > 0 && (
            <Fallback option={alternative} onSelect={selectGarage} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {levelOptions.length > 1 && (
            <LevelPicker
              options={levelOptions}
              selectedLevelId={level.id}
              onSelect={setLevelId}
            />
          )}
          <StallPanel
            garage={garage}
            level={level}
            counts={live.levelCounts(level)}
            stalls={live.stalls}
            permit={permit}
            highContrast={highContrast}
          />
        </div>

        <section
          aria-label="Campus map"
          className="min-w-0 lg:col-start-1 lg:row-start-2"
        >
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Campus map
          </h2>
          <div className="h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-80">
            <CampusMapLoader
              pins={garageOptions.map((option) => ({
                garage: option.garage,
                open: option.open,
                availability: availability(option.open, option.total),
              }))}
              selectedGarageId={garage.id}
              onSelectGarage={selectGarage}
            />
          </div>
        </section>
      </main>

      <Footer paused={live.paused} onTogglePaused={() => live.setPaused(!live.paused)} />
    </div>
  );
}
