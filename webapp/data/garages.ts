import lotCG from "./garage-stalls-CG.json";
import lotTR from "./garage-stalls-TR.json";

import { toSpaceType } from "@/lib/spaceTypes";
import type { Garage, Level } from "@/types/parking";

// Stall map files mirror the tables: a lot, its floors, and their spaces. Generated and
// kept in step with the database by scripts/sync_spaces.mjs; label, row and points are
// map-only. Cottage Grove comes from the parkingWeb prototype; Tropicana was traced from
// UNLV Park and Go floor screenshots.
type LotFile = {
  lot_id: number;
  view_box: number[];
  floors: {
    floor_id: number;
    floor_num: number;
    image: string;
    spaces: {
      space_id: number;
      camera_id: number;
      space_type: string;
      label: string;
      row: string;
      points: number[][];
    }[];
  }[];
};

function stallLevels(lot: LotFile, idPrefix = ""): Level[] {
  return [...lot.floors]
    .sort((a, b) => a.floor_num - b.floor_num)
    .map((floor) => ({
      id: `${idPrefix}level${floor.floor_num}`,
      name: `Level ${floor.floor_num}`,
      floorNum: floor.floor_num,
      floorId: floor.floor_id,
      imageUrl: floor.image,
      stalls: floor.spaces.map((space) => ({
        id: space.label,
        spaceId: space.space_id,
        cameraId: space.camera_id,
        strip: space.row,
        type: toSpaceType(space.space_type),
        points: space.points,
      })),
    }));
}

// Pin locations are approximate. lotId is lots.lot_id.
export const garages: Garage[] = [
  {
    id: "cottage-grove",
    name: "Cottage Grove Garage",
    shortName: "Cottage Grove",
    kind: "garage",
    lotId: lotCG.lot_id,
    location: [36.1115, -115.1398],
    viewBox: lotCG.view_box,
    levels: stallLevels(lotCG),
  },
  {
    id: "tropicana",
    name: "Tropicana Garage",
    shortName: "Tropicana",
    kind: "garage",
    lotId: lotTR.lot_id,
    location: [36.1013, -115.1441],
    viewBox: lotTR.view_box,
    levels: stallLevels(lotTR, "tropicana-"),
  },
  {
    // Not in the database yet. To show live counts, add its lot and floor rows and set
    // lotId here and floorId on the level below.
    id: "thomas-mack",
    name: "Thomas & Mack Lots",
    shortName: "Thomas & Mack",
    kind: "lot",
    location: [36.1041, -115.1478],
    levels: [{ id: "thomas-mack-surface", name: "Surface lots", floorNum: 1 }],
  },
];
