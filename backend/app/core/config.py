from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Jotter"
    DEBUG: bool = False
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = ""
    SYNC_DATABASE_URL: str = ""

    FRONTEND_URL: str = "http://localhost:5173"
    GOOGLE_CLIENT_ID: str = ""
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:6565",
        "http://127.0.0.1:6565",
        "http://localhost:4173",
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost",
    ]

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    FROM_EMAIL: str = "noreply@jotter.app"

    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        missing = []
        if not self.SECRET_KEY:
            missing.append("SECRET_KEY")
        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")
        if not self.SYNC_DATABASE_URL:
            missing.append("SYNC_DATABASE_URL")
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        if not self.DEBUG and not self.SYNC_DATABASE_URL.startswith("mysql"):
            raise ValueError("SYNC_DATABASE_URL must use MySQL in production (non-DEBUG mode)")


settings = Settings()
