"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so both maps load on the client only.
function MapPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  );
}

export const StallMapLoader = dynamic(() => import("./StallMap"), {
  ssr: false,
  loading: MapPlaceholder,
});

export const CampusMapLoader = dynamic(() => import("./CampusMap"), {
  ssr: false,
  loading: MapPlaceholder,
});
