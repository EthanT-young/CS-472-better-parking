import rawStallsCG from "./garage-stalls-CG.json";

import type { Garage, Level, Stall } from "@/types/parking";

// The garage with a mapped, stall-by-stall floor plan (from the parkingWeb prototype).
const stallLevels: Level[] = Object.entries(
  rawStallsCG.levels as Record<string, Stall[]>
).map(([levelId, stalls], index) => ({
  id: levelId,
  name: index === 0 ? "Level 1" : `Level ${index + 1}`,
  imageUrl: `/maps/garage-1/${levelId}.svg`,
  stalls,
}));

function countOnlyLevels(prefix: string, count: number): Level[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-level${index + 1}`,
    name: `Level ${index + 1}`,
  }));
}

// Pin locations are approximate.
export const garages: Garage[] = [
  {
    id: "cottage-grove",
    name: "Cottage Grove Garage",
    shortName: "Cottage Grove",
    kind: "garage",
    location: [36.1115, -115.1398],
    viewBox: rawStallsCG.viewBox,
    levels: stallLevels,
  },
  {
    id: "tropicana",
    name: "Tropicana Garage",
    shortName: "Tropicana",
    kind: "garage",
    location: [36.1013, -115.1441],
    levels: countOnlyLevels("tropicana", 5),
  },
  {
    id: "thomas-mack",
    name: "Thomas & Mack Lots",
    shortName: "Thomas & Mack",
    kind: "lot",
    location: [36.1041, -115.1478],
    levels: [{ id: "thomas-mack-surface", name: "Surface lots" }],
  },
];
