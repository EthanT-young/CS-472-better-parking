import type { Availability } from "@/lib/permits";

export const pillClasses: Record<Availability["tone"], string> = {
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  bad: "bg-red-100 text-red-800",
  none: "bg-slate-100 text-slate-600",
};

export const barClasses: Record<Availability["tone"], string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  none: "bg-slate-300",
};

export const numberClasses: Record<Availability["tone"], string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  none: "text-slate-400",
};

export function percentFull(open: number, total: number) {
  return total > 0 ? Math.round(((total - open) / total) * 100) : 0;
}
