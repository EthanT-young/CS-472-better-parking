import type {
  Site,
  Lot,
  Floor,
  Section,
} from "@/types/parking";

/*
|--------------------------------------------------------------------------
| Sites
|--------------------------------------------------------------------------
|
| Top-level parking locations/campuses.
|
*/

export const sites: Site[] = [
  {
    site_id: 1,
    site_name: "UNLV Main Campus",
  },
  {
    site_id: 2,
    site_name: "Shadow Lane Campus",
  },
];

/*
|--------------------------------------------------------------------------
| Lots / Garages
|--------------------------------------------------------------------------
|
| Each lot belongs to one site.
|
*/

export const lots: Lot[] = [
  {
    lot_id: 101,
    site_id: 1,
    lot_name: "Cottage Grove Garage",
  },
  {
    lot_id: 102,
    site_id: 1,
    lot_name: "Tropicana Parking Garage",
  },
  {
    lot_id: 201,
    site_id: 2,
    lot_name: "Shadow Lane Garage",
  },
];

/*
|--------------------------------------------------------------------------
| Floors
|--------------------------------------------------------------------------
|
| Floors are identified using:
|
| lot_id + floor_num
|
| A floor may exist here without having any matching Section rows.
| That intentionally represents a floor whose parking data is unavailable.
|
*/

export const floors: Floor[] = [
  // Cottage Grove Garage
  {
    lot_id: 101,
    floor_num: 1,
  },
  {
    lot_id: 101,
    floor_num: 2,
  },
  {
    lot_id: 101,
    floor_num: 3,
  },
  {
    lot_id: 101,
    floor_num: 4,
  },
  {
    lot_id: 101,
    floor_num: 5,
  },
  {
    lot_id: 101,
    floor_num: 6,
  },

  // Tropicana Parking Garage
  {
    lot_id: 102,
    floor_num: 1,
  },
  {
    lot_id: 102,
    floor_num: 2,
  },
  {
    lot_id: 102,
    floor_num: 3,
  },
  {
    lot_id: 102,
    floor_num: 4,
  },

  // Shadow Lane Garage
  {
    lot_id: 201,
    floor_num: 1,
  },
  {
    lot_id: 201,
    floor_num: 2,
  },
  {
    lot_id: 201,
    floor_num: 3,
  },
];

/*
|--------------------------------------------------------------------------
| Sections
|--------------------------------------------------------------------------
|
| These intentionally create different UI states.
|
| COTTAGE GROVE
|
| Level 1:
|   124 / 368 available
|   ~66% occupied
|   => Plenty available
|
| Level 2:
|   86 / 368 available
|   ~77% occupied
|   => Filling up
|
| Level 3:
|   30 / 368 available
|   ~92% occupied
|   => Nearly full
|
| Level 4:
|   0 / 368 available
|   100% occupied
|   => Full
|
| Level 5:
|   NO SECTION RECORDS
|   => Data unavailable
|
| Level 6:
|   180 / 250 available
|   28% occupied
|   => Plenty available
|
|--------------------------------------------------------------------------
*/

export const sections: Section[] = [
  /*
  |--------------------------------------------------------------------------
  | Cottage Grove Garage — Lot 101
  |--------------------------------------------------------------------------
  */

  // -----------------------------------------------------------------------
  // Level 1
  // 124 available / 368 total
  // -----------------------------------------------------------------------

  {
    lot_id: 101,
    floor_num: 1,
    section_num: 1,
    open_spaces: 35,
    total_spaces: 90,
  },
  {
    lot_id: 101,
    floor_num: 1,
    section_num: 2,
    open_spaces: 32,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 1,
    section_num: 3,
    open_spaces: 29,
    total_spaces: 93,
  },
  {
    lot_id: 101,
    floor_num: 1,
    section_num: 4,
    open_spaces: 28,
    total_spaces: 93,
  },

  // -----------------------------------------------------------------------
  // Level 2
  // 86 available / 368 total
  // -----------------------------------------------------------------------

  {
    lot_id: 101,
    floor_num: 2,
    section_num: 1,
    open_spaces: 22,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 2,
    section_num: 2,
    open_spaces: 20,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 2,
    section_num: 3,
    open_spaces: 21,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 2,
    section_num: 4,
    open_spaces: 23,
    total_spaces: 92,
  },

  // -----------------------------------------------------------------------
  // Level 3
  // 30 available / 368 total
  // -----------------------------------------------------------------------

  {
    lot_id: 101,
    floor_num: 3,
    section_num: 1,
    open_spaces: 8,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 3,
    section_num: 2,
    open_spaces: 7,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 3,
    section_num: 3,
    open_spaces: 8,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 3,
    section_num: 4,
    open_spaces: 7,
    total_spaces: 92,
  },

  // -----------------------------------------------------------------------
  // Level 4
  // 0 available / 368 total
  // Completely full
  // -----------------------------------------------------------------------

  {
    lot_id: 101,
    floor_num: 4,
    section_num: 1,
    open_spaces: 0,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 4,
    section_num: 2,
    open_spaces: 0,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 4,
    section_num: 3,
    open_spaces: 0,
    total_spaces: 92,
  },
  {
    lot_id: 101,
    floor_num: 4,
    section_num: 4,
    open_spaces: 0,
    total_spaces: 92,
  },

  // -----------------------------------------------------------------------
  // Level 5
  //
  // INTENTIONALLY NO SECTION RECORDS.
  //
  // The floor exists in `floors`, but there is no occupancy information.
  //
  // This should display:
  //
  // "Parking availability unavailable"
  //
  // rather than:
  //
  // "0 spaces available"
  //
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Level 6
  // 180 available / 250 total
  // -----------------------------------------------------------------------

  {
    lot_id: 101,
    floor_num: 6,
    section_num: 1,
    open_spaces: 45,
    total_spaces: 63,
  },
  {
    lot_id: 101,
    floor_num: 6,
    section_num: 2,
    open_spaces: 45,
    total_spaces: 63,
  },
  {
    lot_id: 101,
    floor_num: 6,
    section_num: 3,
    open_spaces: 45,
    total_spaces: 62,
  },
  {
    lot_id: 101,
    floor_num: 6,
    section_num: 4,
    open_spaces: 45,
    total_spaces: 62,
  },

  /*
  |--------------------------------------------------------------------------
  | Tropicana Parking Garage — Lot 102
  |--------------------------------------------------------------------------
  */

  // -----------------------------------------------------------------------
  // Level 1
  // 65 available / 280 total
  // ~77% occupied
  // Filling up
  // -----------------------------------------------------------------------

  {
    lot_id: 102,
    floor_num: 1,
    section_num: 1,
    open_spaces: 18,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 1,
    section_num: 2,
    open_spaces: 16,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 1,
    section_num: 3,
    open_spaces: 15,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 1,
    section_num: 4,
    open_spaces: 16,
    total_spaces: 70,
  },

  // -----------------------------------------------------------------------
  // Level 2
  // 18 available / 280 total
  // ~94% occupied
  // Nearly full
  // -----------------------------------------------------------------------

  {
    lot_id: 102,
    floor_num: 2,
    section_num: 1,
    open_spaces: 5,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 2,
    section_num: 2,
    open_spaces: 4,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 2,
    section_num: 3,
    open_spaces: 4,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 2,
    section_num: 4,
    open_spaces: 5,
    total_spaces: 70,
  },

  // -----------------------------------------------------------------------
  // Level 3
  // 140 available / 280 total
  // 50% occupied
  // Plenty available
  // -----------------------------------------------------------------------

  {
    lot_id: 102,
    floor_num: 3,
    section_num: 1,
    open_spaces: 35,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 3,
    section_num: 2,
    open_spaces: 35,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 3,
    section_num: 3,
    open_spaces: 35,
    total_spaces: 70,
  },
  {
    lot_id: 102,
    floor_num: 3,
    section_num: 4,
    open_spaces: 35,
    total_spaces: 70,
  },

  // -----------------------------------------------------------------------
  // Level 4
  //
  // Also intentionally has no section information.
  // This gives us another "unknown" state.
  // -----------------------------------------------------------------------

  /*
  |--------------------------------------------------------------------------
  | Shadow Lane Garage — Lot 201
  |--------------------------------------------------------------------------
  */

  // -----------------------------------------------------------------------
  // Level 1
  // 45 available / 180 total
  // 75% occupied
  // Filling up
  // -----------------------------------------------------------------------

  {
    lot_id: 201,
    floor_num: 1,
    section_num: 1,
    open_spaces: 12,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 1,
    section_num: 2,
    open_spaces: 11,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 1,
    section_num: 3,
    open_spaces: 11,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 1,
    section_num: 4,
    open_spaces: 11,
    total_spaces: 45,
  },

  // -----------------------------------------------------------------------
  // Level 2
  // 9 available / 180 total
  // 95% occupied
  // Nearly full
  // -----------------------------------------------------------------------

  {
    lot_id: 201,
    floor_num: 2,
    section_num: 1,
    open_spaces: 2,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 2,
    section_num: 2,
    open_spaces: 2,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 2,
    section_num: 3,
    open_spaces: 2,
    total_spaces: 45,
  },
  {
    lot_id: 201,
    floor_num: 2,
    section_num: 4,
    open_spaces: 3,
    total_spaces: 45,
  },

  // -----------------------------------------------------------------------
  // Level 3
  //
  // Intentionally no occupancy records.
  // -----------------------------------------------------------------------
];
