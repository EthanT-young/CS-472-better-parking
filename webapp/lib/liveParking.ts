"use client";

import { useEffect, useMemo, useState } from "react";

import { garages } from "@/data/garages";
import { addCounts, emptyCounts } from "@/lib/permits";
import type {
  Garage,
  Level,
  LevelCounts,
  StallStatus,
} from "@/types/parking";

/*
 * Simulated live feed for the demo. Everything the page shows comes from
 * useLiveParking(), so swapping this for the FastAPI /lots/{id}/sections
 * endpoint (or Supabase realtime) only touches this file.
 */

const TICK_MS = 6000;
const HISTORY_MS = 2 * 60 * 1000;
const CHURN = 0.015;

type CountGroup = keyof LevelCounts;

// Target share of taken stalls per level, roughly a 10am weekday.
const stallTargets: Record<string, number> = {
  level1: 0.93,
  level2: 0.88,
  level3: 0.8,
  level4: 0.66,
  level5: 0.48,
  level6: 0.3,
  "tropicana-level1": 0.95,
  "tropicana-level2": 0.88,
  "tropicana-level3": 0.76,
  "tropicana-level4": 0.58,
};

const countLayouts: Record<
  string,
  { totals: Record<CountGroup, number>; target: number }
> = {
  "thomas-mack-surface": { totals: { student: 900, staff: 120, other: 80 }, target: 0.35 },
};

export function stallGroup(type: string): CountGroup {
  if (type === "Student") return "student";
  if (type === "Staff") return "staff";
  return "other";
}

// Small seeded PRNG so the first render matches between server and client.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type FeedState = {
  stalls: Record<string, StallStatus>;
  counts: Record<string, LevelCounts>;
  updatedAt: number | null;
  history: { t: number; taken: Record<string, number> }[];
};

function stallTarget(level: Level, type: string) {
  const base = stallTargets[level.id] ?? 0.6;
  // Reserved and staff stalls on the ground floor are close to full by mid-morning.
  return type === "Student" ? base : Math.min(base + 0.03, 0.97);
}

function initialState(): FeedState {
  const random = mulberry32(472);
  const stalls: Record<string, StallStatus> = {};
  const counts: Record<string, LevelCounts> = {};

  for (const garage of garages) {
    for (const level of garage.levels) {
      if (level.stalls) {
        for (const stall of level.stalls) {
          stalls[stall.id] =
            random() < stallTarget(level, stall.type) ? "taken" : "open";
        }
        continue;
      }

      const layout = countLayouts[level.id];
      if (!layout) continue;

      const levelCounts = emptyCounts();
      for (const group of Object.keys(layout.totals) as CountGroup[]) {
        const total = layout.totals[group];
        let open = 0;
        for (let i = 0; i < total; i++) {
          if (random() >= layout.target) open++;
        }
        levelCounts[group] = { open, total };
      }
      counts[level.id] = levelCounts;
    }
  }

  return { stalls, counts, updatedAt: null, history: [] };
}

// Mostly steady, with a slight net inflow so the fill rate reads like a morning.
function flip(status: StallStatus, target: number, random: () => number) {
  const fill = CHURN * Math.min(target + 0.08, 0.99);
  const leave = CHURN * (1 - target);
  if (status === "open") return random() < fill ? "taken" : "open";
  return random() < leave ? "open" : "taken";
}

function nextState(state: FeedState, now: number): FeedState {
  const random = Math.random;
  const stalls = { ...state.stalls };
  const counts: Record<string, LevelCounts> = {};

  for (const garage of garages) {
    for (const level of garage.levels) {
      if (level.stalls) {
        for (const stall of level.stalls) {
          stalls[stall.id] = flip(
            stalls[stall.id],
            stallTarget(level, stall.type),
            random
          );
        }
        continue;
      }

      const layout = countLayouts[level.id];
      const current = state.counts[level.id];
      if (!layout || !current) continue;

      const levelCounts = emptyCounts();
      for (const group of Object.keys(current) as CountGroup[]) {
        const { open, total } = current[group];
        let nextOpen = open;
        for (let i = 0; i < total; i++) {
          const status = i < open ? "open" : "taken";
          const next = flip(status, layout.target, random);
          if (status !== next) nextOpen += next === "open" ? 1 : -1;
        }
        levelCounts[group] = { open: nextOpen, total };
      }
      counts[level.id] = levelCounts;
    }
  }

  const next = { ...state, stalls, counts, updatedAt: now };
  const taken = Object.fromEntries(
    garages.map((garage) => [garage.id, takenInGarage(next, garage)])
  );

  return {
    ...next,
    history: [...state.history, { t: now, taken }].filter(
      (entry) => now - entry.t <= HISTORY_MS
    ),
  };
}

function levelCountsFor(state: FeedState, level: Level): LevelCounts | null {
  if (!level.stalls) return state.counts[level.id] ?? null;

  const counts = emptyCounts();
  for (const stall of level.stalls) {
    const group = counts[stallGroup(stall.type)];
    group.total++;
    if (state.stalls[stall.id] === "open") group.open++;
  }
  return counts;
}

function takenInGarage(state: FeedState, garage: Garage) {
  let taken = 0;
  for (const level of garage.levels) {
    const counts = levelCountsFor(state, level);
    if (!counts) continue;
    for (const group of Object.values(counts)) {
      taken += group.total - group.open;
    }
  }
  return taken;
}

export type LiveParking = {
  stalls: Record<string, StallStatus>;
  updatedAt: number | null;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  levelCounts: (level: Level) => LevelCounts | null;
  garageCounts: (garage: Garage) => LevelCounts;
  // Net cars in (positive) or out over roughly the last minute.
  carsLastMinute: (garage: Garage) => number | null;
};

export function useLiveParking(): LiveParking {
  const [state, setState] = useState(initialState);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    const tick = () => setState((current) => nextState(current, Date.now()));
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, TICK_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [paused]);

  return useMemo(() => {
    const levelCounts = (level: Level) => levelCountsFor(state, level);

    return {
      stalls: state.stalls,
      updatedAt: state.updatedAt,
      paused,
      setPaused,
      levelCounts,
      garageCounts: (garage: Garage) =>
        garage.levels.reduce(
          (sum, level) => addCounts(sum, levelCounts(level) ?? emptyCounts()),
          emptyCounts()
        ),
      carsLastMinute: (garage: Garage) => {
        const latest = state.history.at(-1);
        if (!latest) return null;
        const baseline =
          state.history.find((entry) => latest.t - entry.t <= 60_000) ??
          latest;
        if (baseline === latest) return null;
        return latest.taken[garage.id] - baseline.taken[garage.id];
      },
    };
  }, [state, paused]);
}
