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