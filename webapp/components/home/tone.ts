import type { Availability } from "@/lib/permits";

// Status text is black on every tint (at least 16:1), so it never reads as color on color;
// the tint is a secondary cue and the label carries the meaning.
export const pillClasses: Record<Availability["tone"], string> = {
  good: "bg-emerald-100 text-black",
  warn: "bg-amber-100 text-black",
  bad: "bg-red-100 text-black",
  none: "bg-slate-100 text-black",
};

// Contrast (WCAG 2.2 AA) is measured against the bar track and card backgrounds:
// bars are at least 4:1 on slate-200, numbers at least 4.5:1 on white.
export const barClasses: Record<Availability["tone"], string> = {
  good: "bg-emerald-700",
  warn: "bg-amber-700",
  bad: "bg-red-700",
  none: "bg-slate-500",
};

export const numberClasses: Record<Availability["tone"], string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  none: "text-slate-500",
};

export function percentFull(open: number, total: number) {
  return total > 0 ? Math.round(((total - open) / total) * 100) : 0;
}
