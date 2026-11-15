from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str

    cors_origins: list[str] = ["localhost", "http://localhost", "http://localhost:3000"]
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

