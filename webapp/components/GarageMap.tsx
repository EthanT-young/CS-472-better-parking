"use client";

import L from "leaflet";
import {
  MapContainer,
  ImageOverlay,
  Tooltip,
  Polygon,
} from "react-leaflet";

import {garages, type Status } from "../data/parking";
import type { GarageMapProps } from "./GarageMapLoader";

// May not be implemented in first iteration of prototype
// type ParkingType = "student" | "accessibility" | "staff" | 
//   "electricVehicle" | "reserved" | "motorcycle" | "shortTerm"; 

const spotColors: Record<Status, string> = {
  Available: "#2ba73e",
  Occupied: "#dd1111",
  Unknown: "#857b7b",
};

// May not be implemented in first iteration of prototype
// const spotType: Record<ParkingType, string> ={
//   student: "#e9722d",
//   accessibility: "#51f4fc",
//   staff: "#fbf144",
//   electricVehicle: "#a844fb",
//   reserved: "#633737",
//   motorcycle: "#1e1c1b",
//   shortTerm: "#db5edf",
// }

export default function GarageMap({garageId, levelId, statuses,}: GarageMapProps) {
  const garage = garages.find((item) => item.id ===garageId);
  const floor = garage?.levels.find((item) => item.id === levelId);

  if(!garage || !floor) {
    return <p>No layout is available for this garage and level.</p>;
  }

  const [minX, minY, width, height] = garage.viewBox;

  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [height, width],
  ];

  function toMapPoint(point: number[]): L.LatLngTuple {
    const [x, y] = point;

    return [
      height - (y - minY),
      x - minX,
    ];
  }

  return (
    <section>
      <h2>{garage.name} - {floor.name}</h2>

      <MapContainer
        key={`${garageId}:${levelId}`}
        crs= {L.CRS.Simple} 
        bounds= {bounds}
        boundsOptions={{ padding: [16, 16] }}
        minZoom= {-1.5}
        maxZoom= {1.5}
        zoomSnap= {0.25}
        style={{
            height: "650px",
            width: "100%",
            backgroundColor: "#e5e7eb",
        }}>
            
        <ImageOverlay url={floor.imageUrl} bounds={bounds} interactive={false}/>

        {floor.stalls.map((stall) => {
          const status = statuses[stall.id] ?? "Unknown";

          return(
            <Polygon
              key= {stall.id}
              positions={stall.points.map(toMapPoint)}
              pathOptions= {{
                color: spotColors[status],
                weight: 1,
                fillColor: spotColors[status],
                fillOpacity: status === "Unknown" ? 0.12 : 0.65,
              }}>

              <Tooltip sticky>
                {stall.type} : {status}
              </Tooltip>
            </Polygon> 
          ); 
        })}
      </MapContainer>
    </section>
  );
}