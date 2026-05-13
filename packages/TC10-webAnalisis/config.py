from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./reviews.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SENTIMENT_API_URL: str = "http://localhost:8000/analyze"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
