import rawStallsCG from "./garage-stalls-CG.json";
import rawStallsTR from "./garage-stalls-TR.json";

import type { Garage, Level, Stall } from "@/types/parking";

// Garages with a stall-by-stall floor plan. Cottage Grove comes from the parkingWeb
// prototype; Tropicana was traced from UNLV Park and Go floor screenshots.
function stallLevels(
  raw: { levels: Record<string, Stall[]> },
  mapFolder: string,
  idPrefix = ""
): Level[] {
  return Object.entries(raw.levels).map(([levelId, stalls], index) => ({
    id: `${idPrefix}${levelId}`,
    name: `Level ${index + 1}`,
    imageUrl: `/maps/${mapFolder}/${levelId}.svg`,
    stalls,
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
    levels: stallLevels(rawStallsCG, "garage-1"),
  },
  {
    id: "tropicana",
    name: "Tropicana Garage",
    shortName: "Tropicana",
    kind: "garage",
    location: [36.1013, -115.1441],
    viewBox: rawStallsTR.viewBox,
    levels: stallLevels(rawStallsTR, "garage-2", "tropicana-"),
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
