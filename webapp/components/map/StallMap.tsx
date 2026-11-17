"use client";

import L from "leaflet";
import { ImageOverlay, MapContainer, Polygon } from "react-leaflet";

import { canPark } from "@/lib/permits";

import { labelMap } from "./labelMap";
import type { Level, Permit, Stall, StallStatus } from "@/types/parking";

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

// Two states only (open / taken); patterns carry the meaning as well as color.
// Every edge and fill is at least 3:1 against the map background (WCAG 1.4.11):
// open is emerald-600 (3.5:1) inside a near-black border, taken is slate-500 with white
// stripes, and stalls outside your permit have a slate-500 dashed edge (4.5:1).
function stallStyle(
  status: StallStatus,
  eligible: boolean,
  selected: boolean,
  highContrast: boolean
): L.PathOptions {
  if (!eligible) {
    return {
      color: highContrast ? "#000000" : "#62748e",
      weight: 0.75,
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
          fillColor: highContrast ? "url(#stall-open-hc)" : "url(#stall-open)",
          fillOpacity: 1,
        }
      : {
          color: highContrast ? "#000000" : "#334155",
          weight: 1,
          fillColor: highContrast ? "url(#stall-taken-hc)" : "url(#stall-taken)",
          fillOpacity: 1,
        };

  // Black outline over a white halo (drawn separately): visible on any fill, and not red vs green.
  return selected ? { ...base, color: "#000000", weight: 3 } : base;
}

const selectedHalo: L.PathOptions = {
  color: "#ffffff",
  weight: 7,
  fill: false,
  interactive: false,
};

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

  function stallPolygon(stall: Stall) {
    const status = stalls[stall.id] ?? "taken";
    const eligible = canPark(permit, stall.type);

    return (
      <Polygon
        key={stall.id}
        positions={stall.points.map(toMapPoint)}
        pathOptions={stallStyle(
          status,
          eligible,
          stall.id === selectedStallId,
          highContrast
        )}
        eventHandlers={{ click: () => onSelectStall(stall) }}
      />
    );
  }

  // The selected stall is drawn last so its outline isn't covered by its neighbours.
  const selectedStall = level.stalls?.find((stall) => stall.id === selectedStallId);

  return (
    <MapContainer
      ref={(map) =>
        labelMap(
          map,
          `Stall map, ${level.name}. Use arrow keys to pan and plus or minus to zoom. ` +
            "Open stalls are also listed below the map."
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
      // One-finger drags scroll the page on phones; pinch still zooms.
      dragging={!L.Browser.mobile}
      attributionControl={false}
      className="stall-map h-full w-full"
    >
      {level.imageUrl && (
        <ImageOverlay
          url={level.imageUrl}
          bounds={bounds}
          interactive={false}
          className="stall-map-floorplan"
        />
      )}

      {level.stalls
        ?.filter((stall) => stall.id !== selectedStallId)
        .map(stallPolygon)}

      {selectedStall && (
        <>
          <Polygon
            key={`${selectedStall.id}:halo`}
            positions={selectedStall.points.map(toMapPoint)}
            pathOptions={selectedHalo}
          />
          {stallPolygon(selectedStall)}
        </>
      )}
    </MapContainer>
  );
}
