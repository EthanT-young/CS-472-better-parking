import type { Floor, Lot, Section, Site } from "../types/parking";

export const sites: Site[] = [
  {
    site_id: 1,
    site_name: "UNLV",
  }
];

export const lots: Lot[] = [
  {
    lot_id: 1,
    site_id: 1,
    lot_name: "Cottage Grove Parking Garage",
  },
  {
    lot_id: 2,
    site_id: 1,
    lot_name: "Tropicana Parking Garage",
  }
];

export const floors: Floor[] = [
  {
    lot_id: 1,
    floor_num: 1,
  },
  {
    lot_id: 1,
    floor_num: 2,
  },
  {
    lot_id: 1,
    floor_num: 3,
  },
  {
    lot_id: 1,
    floor_num: 4,
  },
  {
    lot_id: 1,
    floor_num: 5,
  },
  {
    lot_id: 1,
    floor_num: 6,
  },
  {
    lot_id: 2,
    floor_num: 1,
  },
  {
    lot_id: 2,
    floor_num: 2,
  },
  {
    lot_id: 2,
    floor_num: 3,
  },
  {
    lot_id: 2,
    floor_num: 4,
  },
  {
    lot_id: 2,
    floor_num: 5,
  },
  {
    lot_id: 2,
    floor_num: 6,
  }
];

// Since we only need some mock data for now, we only need a few sections and floors.
// Eventually we can add more info but we can also use this to error check on front end if we don't get information.
export const sections: Section[] = [
  {
    lot_id: 1,
    floor_num: 1,
    section_num: 1,
    open_spaces: 10,
    total_spaces: 20,
  },
  {
    lot_id: 1,
    floor_num: 1,
    section_num: 2,
    open_spaces: 5,
    total_spaces: 15,
  },
  {
    lot_id: 1,
    floor_num: 2,
    section_num: 1,
    open_spaces: 8,
    total_spaces: 18,
  },
];