import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Browser client for the `parking` schema. It only ever reads, so it uses the
 * publishable key; row-level security on the tables decides what it can see.
 * The secret key stays with the API (api/.env).
 */

// One row of parking.spaces: a single parking space and whether it's taken.
export type SpaceRow = {
  space_id: number;
  floor_id: number;
  camera_id: number;
  // Checked in the frontend only, by lib/spaceTypes.ts.
  space_type: string;
  occupied: boolean;
  created_at: string;
};

export type FloorRow = {
  floor_id: number;
  lot_id: number;
  floor_num: number;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  parking: {
    Tables: {
      sites: Table<{ site_id: number; site_name: string | null; created_at: string }>;
      lots: Table<{ lot_id: number; site_id: number; lot_name: string | null; created_at: string }>;
      floors: Table<FloorRow>;
      spaces: Table<SpaceRow>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};

export type ParkingClient = SupabaseClient<Database, "parking">;

// NEXT_PUBLIC_ values are inlined at build time, so they have to be read by their full names.
// The API's SUPABASE_KEY is a secret key and must never be given one of these names.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Postgres schema holding sites/lots/floors/spaces. Defaults to "parking"; set
// NEXT_PUBLIC_SUPABASE_SCHEMA (e.g. "parking_new") while the tables live elsewhere.
// The schema must be listed under "Exposed schemas" in Supabase's API settings.
export const supabaseSchema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA?.trim() || "parking";

// A secret key in the browser would give every visitor full database access, so refuse it.
function isSecretKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).role === "service_role";
  } catch {
    return false;
  }
}

const key = rawKey && isSecretKey(rawKey) ? undefined : rawKey;
if (rawKey && !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the publishable key " +
      "instead; falling back to the demo feed."
  );
}

// Without these the page uses the simulated demo feed.
export const supabaseConfigured = Boolean(url && key);

let client: ParkingClient | null = null;

// Null when the URL or publishable key is missing: the page then uses the demo feed.
export function getSupabase(): ParkingClient | null {
  if (!url || !key) return null;
  client ??= createClient<Database, "parking">(url, key, {
    // The tables are the same in either schema, so the "parking" types still apply.
    db: { schema: supabaseSchema as "parking" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Supabase's API returns at most 1,000 rows per request by default (the "Max rows"
// setting), and the mapped garages alone have about 4,400 spaces. Read them a page at a
// time, ordered by space_id so pages never overlap or skip rows.
const PAGE_SIZE = 1000;

export async function fetchAllSpaces(supabase: ParkingClient): Promise<SpaceRow[]> {
  const rows: SpaceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("spaces")
      .select("space_id, floor_id, camera_id, space_type, occupied, created_at")
      .order("space_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    // A short page is the last one. If "Max rows" is lowered below PAGE_SIZE every page
    // is short, so this would stop early: keep the two in step.
    if (data.length < PAGE_SIZE) return rows;
  }
}
