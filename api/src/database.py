import os
from dotenv import load_dotenv
import asyncio
from supabase import acreate_client, AsyncClient
from supabase.client import AsyncClientOptions

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

# this function was created with the help of claude
# I asked it how to make subscribe_to_spaces() run in the background so that I could upsert data
# while also listening for updates in Supabase.
# I also asked claude for some help with the subscribe_to_spaces() function, but that was just to make sure
# I could safely remove the code I found redundant
async def main():
        sb_async = await create_async_supabase() # create asynchronous Supabase client
        await subscribe_to_spaces(sb_async)

        # loops infinitely to listen for Supabase record changes
        try:
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