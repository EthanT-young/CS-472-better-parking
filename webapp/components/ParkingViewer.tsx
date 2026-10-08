"use client";

import GarageMapLoader from "./GarageMapLoader";
import { useState } from "react";

export default function ParkingViewer() {
   const [garageId, setGarageId] = useState(garages[0].id);
   const [levelId, setLevelId] = useState(garages[0].levels[0].id);

   const selectedGarage = garages.find(
      (garage) => garage.id === garageId
   )!;

   function changeGarage(nextGarageId: string) {
      const nextGarage = garages.find(
         (garage) => garage.id === nextGarageId
      );

      if (!nextGarage) return;

      setGarageId(nextGarage.id);
      setLevelId(nextGarage.levels[0].id);
   }

   return (
      <section>
         <div className= "parking-filters">
            <div className= "parking-filter">
               <label htmlFor="garage-select"> Garage </label>

               <select
                  id="garage-select"
                  value={garageId}
                  onChange={(event) => changeGarage(event.target.value)}>
                  {garages.map((garage) => (
                     <option key={garage.id} value={garage.id}>
                        {garage.name}
                     </option>
                  ))}
               </select>      
            </div>
            
            <div className="parking-filter">
               <label htmlFor="level-select">Level</label>

                  <select
                     id="level-select"
                     value={levelId}
                     onChange={(event) => setLevelId(event.target.value)}>
                     {selectedGarage.levels.map((level) => (
                        <option key={level.id} value={level.id}>
                           {level.name}
                        </option>
                     ))}
                  </select>
               </div>
            </div>

            <GarageMapLoader
               key={`${garageId}:${levelId}`}
               garageId={garageId}
               levelId={levelId} />
      </section>
   );
}

const garages = [
  {
    id: "garage-1",
    name: "Cottage Grove",
    levels: [
      { id: "level-1", name: "Level 1" },
      { id: "level-2", name: "Level 2" },
      { id: "level-3", name: "Level 3" },
      { id: "level-4", name: "Level 4" },
      { id: "level-5", name: "Level 5" },
      { id: "level-6", name: "Level 6" },
    ],
  },
  {
    id: "garage-2",
    name: "Tropicana",
    levels: [
      { id: "level-1", name: "Level 1" },
      { id: "level-2", name: "Level 2" },
      { id: "level-3", name: "Level 3" },
      { id: "level-4", name: "Level 4" },
    ],
  },
];