// Types that match database diagram provided by Jacob
export interface Site {
  site_id: number;
  site_name: string;
}

export interface Lot {
  lot_id: number;
  site_id: number;
  lot_name: string;
}

export interface Floor {
  lot_id: number;
  floor_num: number;
}

export interface Section {
  lot_id: number;
  floor_num: number;
  section_num: number;
  open_spaces: number;
  total_spaces: number;
}