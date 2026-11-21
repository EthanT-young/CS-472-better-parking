import os
from dotenv import load_dotenv
import asyncio
from supabase import acreate_client, AsyncClient
from supabase.client import AsyncClientOptions
import random

load_dotenv()

# initialize async Supabase client for listening to database changes
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
async def create_async_supabase():
    supabase: AsyncClient = await acreate_client(
        url,
        key,
        options=AsyncClientOptions(
            schema="parking",
        )
    )
    return supabase

# runs when a record is updated in Supabase
# prints the payload sent by Supabase
def handle_record_updated(payload):
    print("record updated:", payload)

# listens for updates in the spaces table
async def subscribe_to_spaces(supabase: AsyncClient):
    channel = supabase.channel("room1")

    await (
         channel
        .on_postgres_changes("UPDATE", schema="parking", table="spaces", callback=handle_record_updated)
        .subscribe()
    )

async def upsert_site(supabase: AsyncClient, site_id: int | None, site_name: str):
    """
    Upserts a record into the sites tables on Supabase.
    :param supabase: Asynchronous Supabase client object.
    :param site_id: ID of the site. If None, a unique ID is automatically chosen on Supabase.
    :param site_name: Name of the site.
    :return: JSON object with data of uploaded record.
    """

    # site_id = 1: Cottage Grove
    # site_id = 2: Thomas and Mack
    if site_id is None:
        sites = await (
            supabase.table("sites")
            .upsert([{"site_name": site_name}])
            .execute()
        )
    else:
        sites = await (
            supabase.table("sites")
            .upsert([{"site_id": site_id, "site_name": site_name}])
            .execute()
        )
    return sites

async def upsert_lot(supabase: AsyncClient, lot_id: int | None, site_id: int, lot_name):
    """
    Upserts a record into the lots table on Supabase.
    :param supabase: Asynchronous Supabase client object.
    :param lot_id: ID of the lot. If None, a unique ID is automatically chosen on Supabase.
    :param site_id: ID of the site.
    :param lot_name: Name of the lot.
    :return: JSON object with data of uploaded record.
    """

    # lot_id = 1: Cottage Grove
    # lot_id = 2: Tropicana Garage

    # site_id = 1: Cottage Grove
    # site_id = 2: Thomas and Mack
    if lot_id is None:
        lots = await (
            supabase.table("lots")
            .upsert([{"site_id": site_id, "lot_name": lot_name}])
            .execute()
        )
    else:
        lots = await (
            supabase.table("lots")
            .upsert([{"lot_id": lot_id, "site_id": site_id, "lot_name": lot_name}])
            .execute()
        )

    return lots

async def upsert_floor(supabase: AsyncClient, floor_id: int | None, lot_id: int, floor_num):
    """
    Upserts a record into the floors table on Supabase.
    :param supabase: Asynchronous Supabase client object.
    :param floor_id: ID of the floor. If None, a unique ID is automatically chosen on Supabase.
    :param lot_id: ID of the lot.
    :param floor_num: Floor number on the given lot.
    :return: JSON object with data of uploaded record.
    """

    # lot_id = 1: Cottage Grove
    # lot_id = 2: Tropicana Garage
    if floor_id is None:
        floor = await (
            supabase.table("floors")
            .upsert([{"lot_id": lot_id, "floor_num": floor_num}])
            .execute()
        )
    else:
        floor = await (
            supabase.table("floors")
            .upsert([{"floor_id": floor_id, "lot_id": lot_id, "floor_num": floor_num}])
            .execute()
        )

    return floor

async def upsert_space(supabase: AsyncClient, space_id: int | None, floor_id: int, camera_id: int, space_type: str, occupied: bool):
    """
    Upserts a record into the spaces table on Supabase.
    :param supabase: Asynchronous Supabase client object.
    :param space_id: ID of the space. If None, a unique ID is automatically chosen on Supabase.
    :param floor_id: ID of the floor the space is on.
    :param camera_id: ID of the camera covering the space.
    :param space_type: Type of the space: 'student' or 'staff'.
    :param occupied: Boolean of if the space is occupied.
    :return: JSON object with data of uploaded record.
    """

    # the only valid space types are student of staff
    if space_type not in ("student", "staff"):
        raise ValueError("space_type must be 'student' or 'staff'")

    # In order to sync the records with what the front-end displays...
    # Cottage Grove Parking Garage: space_id 1-300 is floor_id 11, 301-600 is floor_id 12,...
    # Tropicana Parking Garage: starts at floor_id 2260
    if space_id is None:
        space = await (
            supabase.table("spaces")
            .upsert([{"floor_id": floor_id, "camera_id": camera_id,
                      "space_type": space_type, "occupied": occupied}])
            .execute()
        )
    else:
        space = await (
            supabase.table("spaces")
            .upsert([{"space_id": space_id, "floor_id": floor_id, "camera_id": camera_id,
                      "space_type": space_type, "occupied": occupied}])
            .execute()
        )
    return space

async def add_seed_data(sb: AsyncClient):
    # upsert sites and lots
    print("Upserting Sites")
    await upsert_site(supabase=sb, site_id=1, site_name="Cottage Grove")
    await upsert_site(supabase=sb, site_id=2, site_name="Thomas and Mack")
    print("Upserting Lots")
    await upsert_lot(supabase=sb, lot_id=1, site_id=1, lot_name="Cottage Grove")
    await upsert_lot(supabase=sb, lot_id=2, site_id=2, lot_name="Tropicana Garage")
    print("Upserting Floors")
    # floor 1-6 of Cottage Grove (starts at floor_id 11 to sync with front end)
    await upsert_floor(supabase=sb, floor_id=11, lot_id=1, floor_num=1)
    await upsert_floor(supabase=sb, floor_id=12, lot_id=1, floor_num=2)
    await upsert_floor(supabase=sb, floor_id=13, lot_id=1, floor_num=3)
    await upsert_floor(supabase=sb, floor_id=14, lot_id=1, floor_num=4)
    await upsert_floor(supabase=sb, floor_id=15, lot_id=1, floor_num=5)
    await upsert_floor(supabase=sb, floor_id=16, lot_id=1, floor_num=6)
    # floor 1-4 of Tropicana Parking Garage
    await upsert_floor(supabase=sb, floor_id=17, lot_id=2, floor_num=1)
    await upsert_floor(supabase=sb, floor_id=18, lot_id=2, floor_num=2)
    await upsert_floor(supabase=sb, floor_id=19, lot_id=2, floor_num=3)
    await upsert_floor(supabase=sb, floor_id=20, lot_id=2, floor_num=4)
    print("Upserting Spaces")
    # for upserting spaces, combine all records into an array so that we can upsert all 2,000+ spaces in one query
    records = []
    # space counts for each floor in Cottage Grove, calculated by adding up the spaces in each section on UNLV Park & Go
    # will add Thomas and Mack when we figure out how the front-end will pull data from Supabase
    space_counts = {"floor 1": {"id": 11, "staff": 201, "student": 26},
                    "floor 2": {"id": 12, "staff": 39, "student": 378},
                    "floor 3": {"id": 13, "staff": 0, "student": 417},
                    "floor 4": {"id": 14, "staff": 0, "student": 417},
                    "floor 5": {"id": 15, "staff": 0, "student": 417},
                    "floor 6": {"id": 16, "staff": 0, "student": 384}}
    # claude helped with this. I originally was upserting each record individually using for loops
    # and I asked claude to optimize it. It then gave some code that was unnecessarily difficult to understand,
    # so I asked it for a simpler implementation. It responded with code similar to what's below, but
    # I did have to manually fix how it handled accessing dictionary values. claude also decided to take liberties
    # when assigning camera_id for some reason. Overall, the structure was correct, but the actual data... not so much.
    space_id = 1
    for _, floor in space_counts.items(): # goes through every floor
        for space_type in ("staff", "student"): # goes through every type of space (student and staff)
            for i in range(floor[space_type]): # for each space, add a record for Supabase
                records.append({
                    "space_id": space_id,
                    "floor_id": floor['id'],
                    "camera_id": 500,
                    "space_type": space_type,
                    "occupied": random.choice([True, False]),
                })
                space_id += 1

    # upserts all records in one query
    await sb.table("spaces").upsert(records).execute()

    print("Finished adding seed data!!!")


# this function was created with the help of claude
# I asked it how to make subscribe_to_spaces() run in the background so that I could upsert data
# while also listening for updates in Supabase.
# I also asked claude for some help with the subscribe_to_spaces() function, but that was just to make sure
# I could safely remove the code I found redundant
async def main():
        sb_async = await create_async_supabase() # create asynchronous Supabase client
        await subscribe_to_spaces(sb_async)

        try:
            # add seed data for new schema with parking spaces
            await add_seed_data(sb_async)
            # loops infinitely to listen for Supabase record changes
            while True:
                await asyncio.sleep(1)
        finally:
            print("Closing supabase realtime connection...")
            await sb_async.remove_all_channels()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Closing program...")