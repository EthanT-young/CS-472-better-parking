import os
from dotenv import load_dotenv
from supabase import create_client, Client
from supabase.client import ClientOptions

load_dotenv()

# initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(
    url,
    key,
    options=ClientOptions(
        schema="parking",
    )
)

# add seed data for tables in parking schema
# site_id: 1 = Thomas and Mack
# site_id: 2 = Cottage Grove
# lot_id: 1 = Tropicana Parking Garage
# lot_id: 2 = Cottage Grove Parking Garage
def add_seed_data():
    upsert_sites = (
        supabase.table("sites")
        .upsert([{"site_id": 1, "site_name": "Thomas and Mack"}, {"site_id": 2, "site_name": "Cottage Grove"}])
        .execute()
    )
    upsert_lots = (
        supabase.table("lots")
        .upsert([{"lot_id": 1, "site_id": 1, "lot_name": "Tropicana Garage"},
                 {"lot_id": 2, "site_id": 2, "lot_name": "Cottage Grove Parking Garage"}])
        .execute()
    )
    upsert_floors = (
        supabase.table("floors")
        .upsert([{"lot_id": 1, "floor_num": 1},
                 {"lot_id": 1, "floor_num": 2},
                 {"lot_id": 1, "floor_num": 3},
                 {"lot_id": 1, "floor_num": 4},
                 {"lot_id": 2, "floor_num": 1},
                 {"lot_id": 2, "floor_num": 2},
                 {"lot_id": 2, "floor_num": 3},
                 {"lot_id": 2, "floor_num": 4},
                 {"lot_id": 2, "floor_num": 5},
                 {"lot_id": 2, "floor_num": 6}])
        .execute()
    )
    # a couple sections to get started
    upsert_sections = (
        supabase.table("sections")
        .upsert([{"lot_id": 1, "floor_num": 1, "section_num": 1, "open_spaces": 0, "total_spaces": 10},
                 {"lot_id": 1, "floor_num": 1, "section_num": 2, "open_spaces": 0, "total_spaces": 15},
                 {"lot_id": 1, "floor_num": 2, "section_num": 1, "open_spaces": 0, "total_spaces": 20},
                 {"lot_id": 1, "floor_num": 2, "section_num": 2, "open_spaces": 0, "total_spaces": 14},
                 {"lot_id": 1, "floor_num": 2, "section_num": 3, "open_spaces": 0, "total_spaces": 8},
                 {"lot_id": 2, "floor_num": 1, "section_num": 1, "open_spaces": 0, "total_spaces": 19}
                 ])
        .execute()
    )

try:
    add_seed_data()
except Exception as err:
    print(f"Adding seed data failed: {err}")