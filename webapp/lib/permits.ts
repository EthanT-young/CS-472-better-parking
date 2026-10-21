import type { LevelCounts, Permit } from "@/types/parking";

export const permitLabels: Record<Permit, string> = {
  student: "Student",
  staff: "Staff",
  all: "Show all",
};

// Students park in student stalls; staff park in staff and student stalls.
export function canPark(permit: Permit, stallType: string): boolean {
  if (permit === "all") return true;
  if (stallType === "Student") return true;
  return permit === "staff" && stallType === "Staff";
}

export function eligibleCounts(
  permit: Permit,
  counts: LevelCounts
): { open: number; total: number } {
  const groups =
    permit === "student"
      ? [counts.student]
      : permit === "staff"
        ? [counts.student, counts.staff]
        : [counts.student, counts.staff, counts.other];

  return groups.reduce(
    (sum, group) => ({
      open: sum.open + group.open,
      total: sum.total + group.total,
    }),
    { open: 0, total: 0 }
  );
}

export function emptyCounts(): LevelCounts {
  return {
    student: { open: 0, total: 0 },
    staff: { open: 0, total: 0 },
    other: { open: 0, total: 0 },
  };
}

export function addCounts(a: LevelCounts, b: LevelCounts): LevelCounts {
  return {
    student: {
      open: a.student.open + b.student.open,
      total: a.student.total + b.student.total,
    },
    staff: {
      open: a.staff.open + b.staff.open,
      total: a.staff.total + b.staff.total,
    },
    other: {
      open: a.other.open + b.other.open,
      total: a.other.total + b.other.total,
    },
  };
}

export type Availability = {
  label: "Plenty available" | "Filling up" | "Nearly full" | "Full" | "No data";
  tone: "good" | "warn" | "bad" | "none";
};

// Thresholds from the summary design, applied to the stalls you can use.
export function availability(open: number, total: number): Availability {
  if (total === 0) return { label: "No data", tone: "none" };

  const percentFull = Math.round(((total - open) / total) * 100);

  if (open === 0) return { label: "Full", tone: "bad" };
  if (percentFull >= 90) return { label: "Nearly full", tone: "bad" };
  if (percentFull >= 70) return { label: "Filling up", tone: "warn" };
  return { label: "Plenty available", tone: "good" };
}
