"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import type { Availability } from "@/lib/permits";
import type { Garage } from "@/types/parking";

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
          title={`${pin.garage.name}: ${pin.open} open for you`}
          eventHandlers={{ click: () => onSelectGarage(pin.garage.id) }}
        />
      ))}
    </MapContainer>
  );
}
