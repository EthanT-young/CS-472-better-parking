export type Permit = "student" | "staff" | "all";

export type StallStatus = "open" | "taken";

export interface Stall {
  id: string;
  strip: string;
  type: string;
  zone: string;
  points: number[][];
}

export interface Level {
  id: string;
  name: string;
  // Only garages with a mapped floor plan have stalls and an image.
  imageUrl?: string;
  stalls?: Stall[];
}

export interface Garage {
  id: string;
  name: string;
  shortName: string;
  kind: "garage" | "lot";
  // [lat, lng], approximate, for the campus map pin.
  location: [number, number];
  viewBox?: number[];
  levels: Level[];
}

// Count-only availability, the shape the Supabase `sections` table gives us.
export interface LevelCounts {
  student: { open: number; total: number };
  staff: { open: number; total: number };
  other: { open: number; total: number };
}
