from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Jotter"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-at-least-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "mysql+aiomysql://root:123456@localhost:3306/jotter_db"
    SYNC_DATABASE_URL: str = "mysql+pymysql://root:123456@localhost:3306/jotter_db"

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


settings = Settings()
