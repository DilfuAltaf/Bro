from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    NESTJS_URL: str = "http://localhost:4000"
    WEB_SEARCH_PROVIDER: str = "duckduckgo"
    WEB_SEARCH_API_KEY: str = ""
    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
