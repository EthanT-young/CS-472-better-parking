type LevelOccupancy = {
   id: string;
   name: string;
   total: number;
   occupied: number;
   unknown: number;
};

type GarageOccupancy = {
   name: string;
   levels: LevelOccupancy[];
};

const garageOccupancy: Record<string, GarageOccupancy> = {
   "garage-1": {
      name: "Cottage Grove",
      levels: [
         {
            id: "level-1",
            name: "Level 1",
            total: 3,
            occupied: 1,
            unknown: 0,
         },
         {
            id: "level-2",
            name: "Level 2",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-3",
            name: "Level 3",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-4",
            name: "Level 4",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-5",
            name: "Level 5",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-6",
            name: "Level 6",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
      ],
   },

   "garage-2": {
      name: "Tropicana",
      levels: [
         {
            id: "level-1",
            name: "Level 1",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-2",
            name: "Level 2",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-3",
            name: "Level 3",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
         {
            id: "level-4",
            name: "Level 4",
            total: 2,
            occupied: 0,
            unknown: 2,
         },
      ],
   },
};

type OccupancyMonitorProps = {
   garageId: string;
};

export default function OccupancyMonitor({ garageId, }: OccupancyMonitorProps) {
   const garage = garageOccupancy[garageId];

   if (!garage) {
      return <p>No occupancy data available.</p>;
   }

   return (
      <aside className="occupancy-monitor" aria-label="Garage occupancy">
         <h2>{garage.name} Occupancy</h2>
         <p>Filled portion represents occupied spots.</p>

         {garage.levels.map((level) => {
            const available =
               level.total - level.occupied - level.unknown;

            const percent =
               level.total > 0 ? Math.round((level.occupied / level.total) * 100) : 0;

         const usageClass =
            percent >= 90
               ? "occupancy-high"
               : percent >= 70
               ? "occupancy-medium"
               : "occupancy-low";

         return (
            <section className="occupancy-level" key={level.id}>
               <div className="occupancy-heading">
                  <h3>{level.name}</h3>
                  <span>
                     {level.total > 0 ? `${percent}% occupied` : "No spots"}
                  </span>
               </div>

               {level.total > 0 && (
                  <progress
                     className={`occupancy-bar ${usageClass}`}
                     value={level.occupied}
                     max={level.total}
                     aria-label={`${level.name} occupancy`}
                     aria-valuetext={
                        `${level.occupied} of ${level.total} spots occupied`
                     }/>
                  )}
               <p>
                  {available} available · {level.occupied}/{level.total} occupied
               </p>

               {level.unknown > 0 && (
                  <p className="occupancy-unknown">
                     {level.unknown} spots have unknown status
                  </p>
               )}
            </section>
         );
         })}
      </aside>
   );
}