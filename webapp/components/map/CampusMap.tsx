"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import type { Availability } from "@/lib/permits";
import type { Garage } from "@/types/parking";

import { labelMap } from "./labelMap";

export type CampusPin = {
  garage: Garage;
  open: number;
  availability: Availability;
};

type CampusMapProps = {
  pins: CampusPin[];
  selectedGarageId: string;
  onSelectGarage: (garageId: string) => void;
};

const toneClasses: Record<Availability["tone"], string> = {
  good: "campus-pin-good",
  warn: "campus-pin-warn",
  bad: "campus-pin-bad",
  none: "campus-pin-none",
};

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// The count's color shows availability; the hidden text says it too, so it isn't color-only
// (WCAG 1.4.1), and names the selected garage for screen readers.
function pinIcon(pin: CampusPin, selected: boolean) {
  return L.divIcon({
    className: "",
    // Sized by CSS; the pin centers itself above its point.
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div class="campus-pin ${toneClasses[pin.availability.tone]}${
      selected ? " campus-pin-selected" : ""
    }">
      <span class="campus-pin-count">${pin.open}</span>
      <span class="campus-pin-name">${escapeHtml(pin.garage.shortName)}</span>
      <span class="sr-only">open for you, ${pin.availability.label}${
        selected ? ", selected" : ""
      }</span>
    </div>`,
  });
}

export default function CampusMap({
  pins,
  selectedGarageId,
  onSelectGarage,
}: CampusMapProps) {
  return (
    <MapContainer
      ref={(map) => labelMap(map, "Campus map. Use arrow keys to pan and plus or minus to zoom.")}
      bounds={L.latLngBounds(pins.map((pin) => pin.garage.location))}
      boundsOptions={{ padding: [60, 50] }}
      minZoom={14}
      maxZoom={18}
      scrollWheelZoom={false}
      dragging={!L.Browser.mobile}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {pins.map((pin) => (
        <Marker
          key={pin.garage.id}
          position={pin.garage.location}
          icon={pinIcon(pin, pin.garage.id === selectedGarageId)}
          title={`${pin.garage.name}: ${pin.open} open for you, ${pin.availability.label}`}
          eventHandlers={{ click: () => onSelectGarage(pin.garage.id) }}
        />
      ))}
    </MapContainer>
  );
}
