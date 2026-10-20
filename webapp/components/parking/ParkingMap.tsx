"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

interface ParkingMapProps {
  center?: [number, number];
  zoom?: number;
}

const DEFAULT_CENTER: [number, number] = [
  -115.1398,
  36.107,
];

const DEFAULT_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [-115.16, 36.09],
  [-115.12, 36.125],
];

export default function ParkingMap({
  center = DEFAULT_CENTER,
  zoom = 16,
}: ParkingMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<mapboxgl.Map | null>(null);

  /*
   * Preserve the values used when Mapbox is first created.
   *
   * After initialization, changes to center/zoom are handled
   * by the second effect instead of rebuilding the entire map.
   */
  const initialCenter = useRef(center);
  const initialZoom = useRef(zoom);

  /*
   * Extract primitive values from center so React's
   * exhaustive-deps rule can track them cleanly.
   */
  const [longitude, latitude] = center;

  /*
   * Initialize Mapbox once.
   */
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    const accessToken =
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      console.error(
        "Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
      );

      return;
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken,
      style: "mapbox://styles/mapbox/standard",
      center: initialCenter.current,
      zoom: initialZoom.current,
      minZoom: 14,
      maxZoom: 20,
      maxBounds: DEFAULT_BOUNDS,
      attributionControl: true,
    });

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
      }),
      "top-right"
    );

    mapRef.current = map;

    /*
     * Mapbox needs to be notified whenever its container
     * changes size because of responsive layout changes.
     */
    const resizeObserver =
      new ResizeObserver(() => {
        map.resize();
      });

    resizeObserver.observe(
      containerRef.current
    );

    return () => {
      resizeObserver.disconnect();

      map.remove();

      mapRef.current = null;
    };
  }, []);

  /*
   * Update the existing map when the selected center
   * or zoom level changes.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.easeTo({
      center: [longitude, latitude],
      zoom,
      duration: 500,
    });
  }, [longitude, latitude, zoom]);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-80 w-full min-w-0 max-w-full overflow-hidden"
    />
  );
}
