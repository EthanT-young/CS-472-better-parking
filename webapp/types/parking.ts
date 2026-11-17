export type Permit = "student" | "staff" | "all";

export type StallStatus = "open" | "taken";

// One space on a stall map, loaded from data/garage-stalls-*.json (see data/garages.ts).
export interface Stall {
  // Label people see, e.g. "L6-B-02" (the file's "label").
  id: string;
  // spaces.space_id, numbered once across all garages by scripts/sync_spaces.mjs.
  spaceId: number;
  // spaces.camera_id: the camera (map section) that watches this space.
  cameraId: number;
  // Row or aisle the space is in (the file's "row").
  strip: string;
  type: SpaceType;
  points: number[][];
}

// Values of parking.spaces.space_type the app understands. Anything else becomes "Unknown"
// (see lib/spaceTypes.ts), which only shows up under "Show all".
export type SpaceType =
  | "Student"
  | "Staff"
  | "Accessibility (ADA)"
  | "Reserved"
  | "Short Term Paid Parking"
  | "Electric Vehicle"
  | "Motorcycle"
  | "Unknown";

export interface Level {
  id: string;
  name: string;
  // floors.floor_num within the garage's lot.
  floorNum: number;
  // floors.floor_id; live spaces are matched to the level by it. Missing until the floor
  // exists in Supabase.
  floorId?: number;
  // Only garages with a mapped floor plan have stalls and an image.
  imageUrl?: string;
  stalls?: Stall[];
}

export interface Garage {
  id: string;
  name: string;
  shortName: string;
  kind: "garage" | "lot";
  // parking.lots.lot_id. Missing until the lot exists in Supabase.
  lotId?: number;
  // [lat, lng], approximate, for the campus map pin.
  location: [number, number];
  viewBox?: number[];
  levels: Level[];
}

// Open / total spaces per permit group, counted from parking.spaces.
export interface LevelCounts {
  student: { open: number; total: number };
  staff: { open: number; total: number };
  other: { open: number; total: number };
}
