import os
from dotenv import load_dotenv
import asyncio
from supabase import acreate_client, AsyncClient
from supabase.client import AsyncClientOptions

load_dotenv()

# initialize supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
async def create_supabase():
    supabase: AsyncClient = await acreate_client(
        url,
        key,
        options=AsyncClientOptions(
            schema="parking",
        )
    )
    return supabase

# runs when a record is updated in supabase
# prints the payload sent by supabase
def handle_record_updated(payload):
    print("record updated:", payload)


# listens for updates in the sections table
async def subscribe_to_sections(supabase: AsyncClient):
    channel = supabase.channel("room1")

    response = (
        await channel
        .on_postgres_changes("UPDATE", schema="parking", table="sections", callback=handle_record_updated)
        .subscribe()
    )

    try:
        # keep script running to listen for events
        while True:
            await asyncio.sleep(1)
    finally:
        # close supabase realtime
        print("Closing supabase realtime connection...")
        await supabase.remove_all_channels()

        """
        The following 5 lines were written by claude.
            I gave it a copy of the file, and told it "This runs fine, but when I force terminate it, I get a bunch of 
            errors". It gave me some code that looked like what I had above (I sent an outdated file without it), 
            although at a glance, it didn't look correct.

            Anyway, after that, I was more specific and said "I get 'Task was destroyed but it is pending!'. 
            It then gave the code below, which worked.

        Additionally, the code
            except KeyboardInterrupt:
                print("Closing program") 
        towards the end of the file was also written by claude in the first query from above. This also worked.
        """
        # cancel any background tasks the realtime client left running
        leftover = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        for task in leftover:
            task.cancel()
        await asyncio.gather(*leftover, return_exceptions=True)


if __name__ == "__main__":
    try:
        sb = asyncio.run(create_supabase()) # create supabase client
        asyncio.run(subscribe_to_sections(sb))
    except KeyboardInterrupt:
        print("Closing program")
    except Exception as err:
        print(f"Adding seed data failed: {err}")