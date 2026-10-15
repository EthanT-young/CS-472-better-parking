import { garages, type Status } from "../data/parking"

type OccupancyMonitorProps = {
  garageId: string;
  statuses: Record<string, Status>;
};

export default function OccupancyMonitor({ garageId, statuses,}: OccupancyMonitorProps) {
   const garage = garages.find((item) => item.id === garageId);
   
   if (!garage) {
      return <p>No occupancy data available.</p>;
   }

   const levels = garage.levels.map((floor) => {
      const counts: Record<Status, number> = {
         Available: 0,
         Occupied: 0,
         Unknown: 0,
      };
      
      for (const stall of floor.stalls) {
         counts[statuses[stall.id] ?? "Unknown"]++;
      }

      return {
         id: floor.id,
         name: floor.name,
         total: floor.stalls.length,
         ...counts,
      };
   });

   return (
      <aside className="occupancy-monitor" aria-label="Garage occupancy">
         <h2>{garage.name} Occupancy</h2>
         <p>Filled portion represents occupied spots.</p>

         {levels.map((level) => {
            const percent =
               level.total > 0 ? Math.round((level.Occupied / level.total) * 100) : 0;

            const hasKnownStatus =
               level.Occupied + level.Available > 0;
               
            const showBar = level.total > 0 && hasKnownStatus;

            const usageClass =
               percent >= 90 ? "occupancy-high"
               : percent >= 70 ? "occupancy-medium"
               : "occupancy-low";

            let occupancyLabel: string;

            if (level.total === 0) {
               occupancyLabel = "No Available Spots";
            }
            else if (!hasKnownStatus) {
               occupancyLabel = "Occupancy Unknown";
            }
            else if (level.Unknown > 0) {
               occupancyLabel = `${percent}% Confirmed Occupied`;
            } 
            else {
               occupancyLabel = `${percent}% Occupied`;
            }

            return (
               <section className="occupancy-level" key={level.id}>
                  <div className="occupancy-heading">
                     <h3>{level.name}</h3>
                     <span>{occupancyLabel}</span>
                  </div>

                  {showBar && (
                     <progress
                        className={`occupancy-bar ${usageClass}`}
                        value={level.Occupied}
                        max={level.total}
                        aria-label={`${level.name} occupancy`}
                        aria-valuetext={
                           `${level.Occupied} of ${level.total} usable spots occupied, ` +
                           `${level.Available} available, ` +
                           `${level.Unknown} unknown`
                        }/>
                  )}
                  
                  <p>
                     {level.Available} Available · {" "} {level.Occupied}/{level.total} occupied
                  </p>

                  {level.Unknown > 0 && (
                     <p className="occupancy-unknown">
                        {level.Unknown} spots have an Unknown status
                     </p>
                  )}
               </section>
            );
         })}
      </aside>
   );
}