import type { SpaceType } from "@/types/parking";

// Frontend-only check of parking.spaces.space_type. The database doesn't constrain the
// column yet, so a value outside this list is mapped to "Unknown": it counts as "other",
// stays hidden from the Student and Staff views, and is logged once so it can be fixed.
export const SPACE_TYPES = [
  "Student",
  "Staff",
  "Accessibility (ADA)",
  "Reserved",
  "Short Term Paid Parking",
  "Electric Vehicle",
  "Motorcycle",
] as const satisfies readonly SpaceType[];

// Case and surrounding spaces are ignored, so "student " still reads as "Student".
const byKey = new Map<string, SpaceType>(SPACE_TYPES.map((type) => [type.toLowerCase(), type]));
const warned = new Set<string>();

export function toSpaceType(value: unknown): SpaceType {
  const text = typeof value === "string" ? value.trim() : "";
  const known = byKey.get(text.toLowerCase());
  if (known) return known;

  const key = JSON.stringify(value) ?? String(value);
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`Unknown space_type ${key}; it is only shown under "Show all".`);
  }
  return "Unknown";
}
