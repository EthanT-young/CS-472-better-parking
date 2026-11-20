
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { ImageOverlay, MapContainer, Polygon } from "react-leaflet";

import { canPark } from "@/lib/permits";
import { labelMap } from "./labelMap";

import type {
  Level,
  Permit,
  Stall,
  StallStatus,
} from "@/types/parking";

export type StallMapProps = {
  garageId: string;
  level: Level;
  viewBox: number[];
  stalls: Record<string, StallStatus>;
  permit: Permit;
  highContrast: boolean;
  selectedStallId: string | null;
  onSelectStall: (stall: Stall) => void;
};

// Two states only (open / taken); patterns carry meaning
// as well as color for WCAG 1.4.1 and 1.4.11.
function stallStyle(
  status: StallStatus | undefined,
  eligible: boolean,
  selected: boolean,
  highContrast: boolean
): L.PathOptions {
  if (status === undefined) {
    return {
      color: "#475569",
      weight: selected ? 3 : 1.5,
      dashArray: "4 3",
      fillColor: "#e2e8f0",
      fillOpacity: 0.8,
    };
  }

  if (!eligible) {
    return {
      color: highContrast ? "#000000" : "#62748e",
      weight: selected ? 3 : 0.75,
      dashArray: "2 3",
      fillColor: "#ffffff",
      fillOpacity: highContrast ? 0 : 0.55,
    };
  }

  const base: L.PathOptions =
    status === "open"
      ? {
          color: highContrast ? "#000000" : "#002c22",
          weight: highContrast ? 2 : 1,
          fillColor: highContrast
            ? "url(#stall-open-hc)"
            : "url(#stall-open)",
          fillOpacity: 1,
        }
      : {
          color: highContrast ? "#000000" : "#334155",
          weight: 1,
          fillColor: highContrast
            ? "url(#stall-taken-hc)"
            : "url(#stall-taken)",
          fillOpacity: 1,
        };

  return selected
    ? { ...base, color: "#000000", weight: 3 }
    : base;
}

// Preserve the white selection halo.
const selectedHalo: L.PathOptions = {
  color: "#ffffff",
  weight: 7,
  fill: false,
  interactive: false,
};

// WCAG 1.1.1, 2.1.1, 4.1.2
// An accessible, keyboard-operable parking stall polygon.
type AccessibleStallPolygonProps = {
  stall: Stall;
  positions: L.LatLngTuple[];
  status: StallStatus | undefined;
  eligible: boolean;
  selected: boolean;
  highContrast: boolean;
  onSelect: (stall: Stall) => void;
};

function AccessibleStallPolygon({
  stall,
  positions,
  status,
  eligible,
  selected,
  highContrast,
  onSelect,
}: AccessibleStallPolygonProps) {
  const polygonRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    const polygon = polygonRef.current;
    const element = polygon?.getElement();

    if (!element) return;

    // Make the SVG path reachable using Tab.
    element.setAttribute("tabindex", "0");

    // Identify the polygon as an interactive button.
    element.setAttribute("role", "button");

    // Give screen readers information about the stall.
    const accessibleLabel = [
      `Stall ${stall.id}`,
      stall.type,
      status === "open"
        ? "Open"
        : status === "taken"
          ? "Taken"
          : "Status unavailable",
      eligible
        ? "Included in selected parking filter"
        : "Outside selected parking filter",
    ].join(", ");

    element.setAttribute("aria-label", accessibleLabel);

    // Indicate which stall is currently selected.
    element.setAttribute("aria-pressed", String(selected));

    // Draw the selected polygon above other polygons.
    // This avoids removing and recreating its DOM element.
    if (selected) {
      polygon?.bringToFront();
    }

    // Allow Enter and Space to select this stall.
    function handleKeyDown(event: Event) {
      if (!(event instanceof KeyboardEvent)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onSelect(stall);
      }
    }

    element.addEventListener("keydown", handleKeyDown);

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  }, [stall, status, eligible, selected, onSelect]);

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
      pathOptions={stallStyle(
        status,
        eligible,
        selected,
        highContrast
      )}
      eventHandlers={{
        click: () => onSelect(stall),
      }}
    />
  );
}

export default function StallMap({
  garageId,
  level,
  viewBox,
  stalls,
  permit,
  highContrast,
  selectedStallId,
  onSelectStall,
}: StallMapProps) {
  const [minX, minY, width, height] = viewBox;

  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [height, width],
  ];

  function toMapPoint([x, y]: number[]): L.LatLngTuple {
    return [height - (y - minY), x - minX];
  }

  // Find the selected stall for its visual halo.
  const selectedStall = level.stalls?.find(
    (stall) => stall.id === selectedStallId
  );

  return (
    <MapContainer
      ref={(map) =>
        labelMap(
          map,
          `Stall map, ${level.name}. ` +
            "Use Tab to navigate parking stalls. " +
            "Press Enter or Space to select a stall. " +
            "Use arrow keys to pan and plus or minus to zoom. " +
            "A parking stall list is also available below the map."
        )
      }
      key={`${garageId}:${level.id}`}
      crs={L.CRS.Simple}
      bounds={bounds}
      boundsOptions={{ padding: [8, 8] }}
      minZoom={-2}
      maxZoom={2}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      // One-finger drags scroll the page on phones;
      // pinch still zooms.
      dragging={!L.Browser.mobile}
      attributionControl={false}
      className="stall-map h-full w-full"
    >
      {/* Garage floor-plan image */}
      {level.imageUrl && (
        <ImageOverlay
          url={level.imageUrl}
          bounds={bounds}
          interactive={false}
          className="stall-map-floorplan"
        />
      )}

      {/* Keep every polygon mounted and keyed consistently.
          This helps preserve focus when selection changes. */}
      {level.stalls?.map((stall) => {
        const status = stalls[stall.id];
        const eligible = canPark(permit, stall.type);
        const selected = stall.id === selectedStallId;

        return (
          <AccessibleStallPolygon
            key={stall.id}
            stall={stall}
            positions={stall.points.map(toMapPoint)}
            status={status}
            eligible={eligible}
            selected={selected}
            highContrast={highContrast}
            onSelect={onSelectStall}
          />
        );
      })}

      {/* Selection halo. This overlay is not interactive.
          The selected polygon is brought above it. */}
      {selectedStall && (
        <Polygon
          key={`${selectedStall.id}:halo`}
          positions={selectedStall.points.map(toMapPoint)}
          pathOptions={selectedHalo}
        />
      )}
    </MapContainer>
  );
}
