from supabase import create_client, Client, ClientOptions
from .config import settings

supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_secret_key,
    options=ClientOptions(schema="parking"),
)

def get_db() -> Client:
    return supabase