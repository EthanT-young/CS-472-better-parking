from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # db
    supabase_url: str
    supabase_key: str

    # pi camera env vars
    device_key_hashes: dict[str, str] = {}
    device_spots: dict[str, list[int]] = {}

    cors_origins: list[str] = ["http://localhost", "http://localhost:3000"]
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    

settings = Settings()

