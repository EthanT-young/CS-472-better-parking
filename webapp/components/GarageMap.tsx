"use client";

import { useState } from "react";
import L from "leaflet";
import {
    MapContainer,
    ImageOverlay,
    Rectangle,
    Tooltip,
    Popup,
} from "react-leaflet";
import { GarageMapProps } from "./GarageMapLoader";

type Status = "Available" | "Occupied" | "Unknown";
type ParkingType = "student" | "accessibility" | "staff" | 
    "electricVehicle" | "reserved" | "motorcycle" | "shortTerm"; 
    // may not be implemented in first iteration of prototype; tentative

type ParkingSpot = {
    id: string;
    bounds: L.LatLngBoundsExpression;
};

type FloorLayout = {
  name: string;
  imageUrl?: string;
  bounds: L.LatLngBoundsExpression;
  spots: ParkingSpot[];
};

const layouts: Record<string, Record<string, FloorLayout>> = {
  "garage-1": {
    "level-1": {
      name: "Cottage Grove — Level 1",
      bounds: [[0, 0], [400, 600]],
      spots: [
        { id: "A1", bounds: [[100, 100], [220, 160]] },
        { id: "A2", bounds: [[100, 170], [220, 230]] },
        { id: "A3", bounds: [[100, 240], [220, 300]] },
      ],
    },
    "level-2": {
      name: "Cottage Grove — Level 2",
      bounds: [[0, 0], [400, 600]],
      spots: [
        { id: "B1", bounds: [[200, 100], [320, 160]] },
        { id: "B2", bounds: [[200, 170], [320, 230]] },
      ],
    },
    "level-3": {
      name: "Cottage Grove — Level 3",
      bounds: [[0, 0], [400, 600]],
      spots: [
        { id: "C1", bounds: [[100, 300], [220, 360]] },
        { id: "C2", bounds: [[100, 370], [220, 430]] },
      ],
    },
  },

  "garage-2": {
    "level-1": {
      name: "Tropicana — Level 1",
      bounds: [[0, 0], [500, 700]],
      spots: [
        { id: "D1", bounds: [[150, 100], [270, 160]] },
        { id: "D2", bounds: [[150, 170], [270, 230]] },
      ],
    },
    "level-2": {
      name: "Tropicana— Level 2",
      bounds: [[0, 0], [500, 700]],
      spots: [
        { id: "E1", bounds: [[250, 300], [370, 360]] },
        { id: "E2", bounds: [[250, 370], [370, 430]] },
      ],
    },
  },
};

const floorBounds: L.LatLngBoundsExpression = [
    [0, 0],
    [400, 600],
];

const spotColors: Record<Status, string> = {
    Available: "#2ba73e",
    Occupied: "#dd1111",
    Unknown: "#857b7b",
};

const spotType: Record<ParkingType, string> ={
    student: "#e9722d",
    accessibility: "#51f4fc",
    staff: "#fbf144",
    electricVehicle: "#a844fb",
    reserved: "#633737",
    motorcycle: "#1e1c1b",
    shortTerm: "#db5edf",
} // may not be implemented in first iteration of prototype; tentative

export default function GarageMap({garageId, levelId,}: GarageMapProps) {
    const floor = layouts[garageId]?.[levelId];
    const [statuses, setStatuses] = useState<Record<string, Status>>({
        A1: "Available",
        A2: "Occupied",
        A3: "Available",
        A4: "Occupied",
    }); // Sample data 

    if(!floor) {
        return <p>No layout is available for this garage and level.</p>;
    }

    const availableCount = floor.spots.filter(
        (spot) => statuses[spot.id] === "Available").length;

    return (
        <section>
            <h2>{floor.name}</h2>

            <MapContainer
                key={`${garageId}:${levelId}`}
                crs= {L.CRS.Simple} 
                bounds= {floor.bounds}
                minZoom= {-1.5}
                maxZoom= {1.5}
                style={{
                    height: "500px",
                    width: "100%",
                    backgroundColor: "#e5e7eb",
                }}>
                
                {floor.imageUrl && (
                    <ImageOverlay url={floor.imageUrl} bounds={floor.bounds}/>
                )}
                    {floor.spots.map((spot) => {
                        const status = statuses[spot.id] ?? "Unknown";

                    return(
                        <Rectangle
                            key= {spot.id}
                            bounds= {spot.bounds}
                            pathOptions= {{
                                color: "#fff",
                                weight: 2,
                                fillColor: spotColors[status],
                                fillOpacity: 0.25,
                            }}>
                            <Tooltip permanent direction= "center">
                                {spot.id}
                            </Tooltip>

                            <Popup>
                                <strong>Spot {spot.id}</strong>
                                <br />
                                Status: {status}
                            </Popup>
                        </Rectangle>
                    );
                })}
            </MapContainer>
        </section>
    );
}