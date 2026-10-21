"use client";

import L from "leaflet";
import { ImageOverlay, MapContainer, Polygon } from "react-leaflet";

import { canPark } from "@/lib/permits";
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
function stallStyle(
  status: StallStatus,
  eligible: boolean,
  selected: boolean,
  highContrast: boolean
): L.PathOptions {
  if (!eligible) {
    return {
      color: highContrast ? "#000000" : "#94a3b8",
      weight: 0.75,
      dashArray: "2 3",
      fillColor: "#ffffff",
      fillOpacity: highContrast ? 0 : 0.55,
    };
  }

  const base: L.PathOptions =
    status === "open"
      ? {
          color: highContrast ? "#000000" : "#047857",
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

  return selected
    ? { ...base, color: "#dc2626", weight: 3 }
    : base;
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

  return (
    <MapContainer
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

      {level.stalls?.map((stall) => {
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
      })}
    </MapContainer>
  );
}
