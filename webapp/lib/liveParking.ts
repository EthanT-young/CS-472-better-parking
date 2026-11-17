"use client";

import { useEffect, useMemo, useState } from "react";

import { garages } from "@/data/garages";
import { addCounts, emptyCounts } from "@/lib/permits";
import { toSpaceType } from "@/lib/spaceTypes";
import {
  fetchAllSpaces,
  getSupabase,
  supabaseConfigured,
  supabaseSchema,
  type ParkingClient,
  type SpaceRow,
} from "@/lib/supabase";
import type {
  Garage,
  Level,
  LevelCounts,
  StallStatus,
} from "@/types/parking";

/*
 * Everything the page shows comes from useLiveParking(). With a Supabase URL and
 * publishable key it reads spaces (from the schema in supabaseSchema), matches them to
 * levels and stalls by floor_id and space_id, and follows changes in realtime; without
 * them it runs the simulated demo feed.
 */

const TICK_MS = 6000;
const HISTORY_MS = 2 * 60 * 1000;
const CHURN = 0.015;

type CountGroup = keyof LevelCounts;

export function stallGroup(type: string): CountGroup {
  if (type === "Student") return "student";
  if (type === "Staff") return "staff";
  return "other";
}

type FeedState = {
  mode: "demo" | "live";
  stalls: Record<string, StallStatus>;
  // Demo: count-only levels. Live: every level that has rows in spaces.
  counts: Record<string, LevelCounts>;
  updatedAt: number | null;
  history: { t: number; taken: Record<string, number> }[];
};

function levelCountsFor(state: FeedState, level: Level): LevelCounts | null {
  const counts = state.counts[level.id];
  if (counts) return counts;
  // Live data is counted per floor from spaces; no rows means no data yet.
  if (state.mode === "live" || !level.stalls) return null;

  const fromStalls = emptyCounts();
  for (const stall of level.stalls) {
    const group = fromStalls[stallGroup(stall.type)];
    group.total++;
    if (state.stalls[stall.id] === "open") group.open++;
  }
  return fromStalls;
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

// Records cars per garage over the last two minutes, for the "fill rate" figure.
function withHistory(previous: FeedState, next: FeedState, now: number): FeedState {
  const taken = Object.fromEntries(
    garages.map((garage) => [garage.id, takenInGarage(next, garage)])
  );
  return {
    ...next,
    updatedAt: now,
    history: [...previous.history, { t: now, taken }].filter(
      (entry) => now - entry.t <= HISTORY_MS
    ),
  };
}

/* ---------- Live feed (Supabase) ---------- */

// floor_id -> level and space_id -> stall (with the level it's drawn on), from the
// stall files, which carry the same IDs as the floors and spaces tables.
const levelByFloorId = new Map<number, Level>();
const stallBySpaceId = new Map<number, { stallId: string; levelId: string }>();
for (const garage of garages) {
  for (const level of garage.levels) {
    if (level.floorId !== undefined) levelByFloorId.set(level.floorId, level);
    for (const stall of level.stalls ?? []) {
      stallBySpaceId.set(stall.spaceId, { stallId: stall.id, levelId: level.id });
    }
  }
}

function liveState(previous: FeedState, spaces: Map<number, SpaceRow>, now: number): FeedState {
  const stalls: Record<string, StallStatus> = {};
  const counts: Record<string, LevelCounts> = {};

  for (const space of spaces.values()) {
    // Spaces on floors the stall files don't have are skipped.
    const level = levelByFloorId.get(space.floor_id);
    if (!level) continue;

    const levelCounts = (counts[level.id] ??= emptyCounts());
    const group = levelCounts[stallGroup(toSpaceType(space.space_type))];
    group.total++;
    if (!space.occupied) group.open++;

    // Color a stall only if the database puts its space on the level the stall is drawn
    // on; otherwise a space_id shared by chance would light up a stall on another floor.
    // The space still counts toward its own floor above.
    const stall = stallBySpaceId.get(space.space_id);
    if (stall?.levelId === level.id) stalls[stall.stallId] = space.occupied ? "taken" : "open";
  }

  return withHistory(previous, { ...previous, stalls, counts }, now);
}

let channelCount = 0;

// Loads every space, then applies realtime changes to spaces. Returns a cleanup.
function runLiveFeed(
  supabase: ParkingClient,
  setState: (update: (current: FeedState) => FeedState) => void
) {
  let cancelled = false;
  const spaces = new Map<number, SpaceRow>();
  // Changes that arrive while a snapshot is loading; reapplied on top of it so a slow
  // snapshot can't roll a space back. null means the row was deleted.
  let pending: Map<number, SpaceRow | null> | null = null;

  const publish = () => setState((current) => liveState(current, spaces, Date.now()));

  const applyChange = (spaceId: number, row: SpaceRow | null) => {
    if (row) spaces.set(spaceId, row);
    else spaces.delete(spaceId);
  };

  async function load() {
    const changes = new Map<number, SpaceRow | null>();
    pending = changes;
    try {
      const spaceRows = await fetchAllSpaces(supabase);
      if (cancelled) return;
      spaces.clear();
      for (const row of spaceRows) spaces.set(row.space_id, row);
      for (const [spaceId, row] of changes) applyChange(spaceId, row);
      publish();
    } catch (error) {
      console.error("Could not load parking spaces from Supabase:", error);
    } finally {
      if (pending === changes) pending = null;
    }
  }

  const channel = supabase
    .channel(`parking-spaces-${++channelCount}`)
    .on<SpaceRow>(
      "postgres_changes",
      { event: "*", schema: supabaseSchema, table: "spaces" },
      (payload) => {
        const row = payload.eventType === "DELETE" ? null : payload.new;
        const spaceId = row?.space_id ?? (payload.old as Partial<SpaceRow>).space_id;
        if (spaceId === undefined) return;
        applyChange(spaceId, row);
        pending?.set(spaceId, row);
        publish();
      }
    )
    .subscribe((status) => {
      // Load on every (re)connect so nothing missed while offline is kept stale. If
      // realtime isn't available, still show the current data once.
      if (status === "SUBSCRIBED") void load();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`Supabase realtime ${status}; showing data without live updates.`);
        void load();
      }
    });

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}

/* ---------- Demo feed (simulated) ---------- */

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

function stallTarget(level: Level, type: string) {
  const base = stallTargets[level.id] ?? 0.6;
  // Reserved and staff stalls on the ground floor are close to full by mid-morning.
  return type === "Student" ? base : Math.min(base + 0.03, 0.97);
}

function initialDemoState(): FeedState {
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

  return { mode: "demo", stalls, counts, updatedAt: null, history: [] };
}

// Mostly steady, with a slight net inflow so the fill rate reads like a morning.
function flip(status: StallStatus, target: number, random: () => number) {
  const fill = CHURN * Math.min(target + 0.08, 0.99);
  const leave = CHURN * (1 - target);
  if (status === "open") return random() < fill ? "taken" : "open";
  return random() < leave ? "open" : "taken";
}

function nextDemoState(state: FeedState, now: number): FeedState {
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

  return withHistory(state, { ...state, stalls, counts }, now);
}

function runDemoFeed(setState: (update: (current: FeedState) => FeedState) => void) {
  const tick = () => setState((current) => nextDemoState(current, Date.now()));
  const first = window.setTimeout(tick, 0);
  const interval = window.setInterval(tick, TICK_MS);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(interval);
  };
}

/* ---------- Hook ---------- */

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
  // The live feed starts empty so simulated numbers never show before real ones arrive.
  const [state, setState] = useState<FeedState>(() =>
    supabaseConfigured
      ? { mode: "live", stalls: {}, counts: {}, updatedAt: null, history: [] }
      : initialDemoState()
  );
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const supabase = getSupabase();
    return supabase ? runLiveFeed(supabase, setState) : runDemoFeed(setState);
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
