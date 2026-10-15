"use client";

import OccupancyMonitor from "./OccupancyMonitor";
import GarageMapLoader from "./GarageMapLoader";
import { garages, initialOccupancy } from "../data/parking";
import { useState } from "react";
// import { supabase } from '@/lib/supabaseClient';

export default function ParkingViewer() {
   const [garageId, setGarageId] = useState(garages[0].id);
   const [levelId, setLevelId] = useState(garages[0].levels[0].id);

   const [occupancy] = useState(initialOccupancy);

   const selectedGarage = garages.find(
      (garage) => garage.id === garageId
   )!;

   const statuses = occupancy[garageId] ?? {};

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

            <div className="parking-dashboard">
               <div className="parking-map-panel">
                  <GarageMapLoader
                     garageId={garageId}
                     levelId={levelId}
                     statuses={statuses} />
               </div>
               <OccupancyMonitor 
                  garageId={garageId} 
                  statuses={occupancy[garageId] ?? {}} />
            </div>
      </section>
   );
}