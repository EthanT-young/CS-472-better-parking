import { canPark } from "@/lib/permits";
import type { Level, Permit, StallStatus } from "@/types/parking";

export type AreaHint = {
  area: string;
  rows: string[];
  open: number;
};

const columns = ["left", "middle", "right"];
const rowNames = ["top", "bottom"];

// Splits the floor plan into a 3x2 grid and finds the area with the most usable open stalls.
export function bestArea(
  level: Level,
  viewBox: number[],
  stalls: Record<string, StallStatus>,
  permit: Permit
): AreaHint | null {
  const [minX, minY, width, height] = viewBox;
  const areas = new Map<string, { open: number; rows: Map<string, number> }>();

  for (const stall of level.stalls ?? []) {
    if (stalls[stall.id] !== "open" || !canPark(permit, stall.type)) continue;

    const cx = stall.points.reduce((sum, [x]) => sum + x, 0) / stall.points.length;
    const cy = stall.points.reduce((sum, [, y]) => sum + y, 0) / stall.points.length;
    const col = columns[Math.min(2, Math.floor(((cx - minX) / width) * 3))];
    const row = rowNames[Math.min(1, Math.floor(((cy - minY) / height) * 2))];
    const name = `${row} ${col}`;

    const area = areas.get(name) ?? { open: 0, rows: new Map() };
    area.open++;
    area.rows.set(stall.strip, (area.rows.get(stall.strip) ?? 0) + 1);
    areas.set(name, area);
  }

  let best: AreaHint | null = null;
  for (const [area, { open, rows }] of areas) {
    if (best && open <= best.open) continue;
    best = {
      area,
      open,
      rows: [...rows.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([strip]) => strip),
    };
  }
  return best;
}
