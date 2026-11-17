import type L from "leaflet";

// Leaflet makes the map box keyboard-focusable (arrow keys pan) but gives it no name,
// so screen reader users land on an unlabeled element. Name it as a region.
export function labelMap(map: L.Map | null, label: string) {
  const container = map?.getContainer();
  if (!container) return;
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", label);
}
