from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for statement in OPTIONAL_SCHEMA_UPGRADES:
            try:
                await conn.execute(text(statement))
            except Exception:
                pass


OPTIONAL_SCHEMA_UPGRADES = [
    "ALTER TABLE notes ADD COLUMN category_names TEXT NULL",
    "ALTER TABLE notes ADD COLUMN group_id VARCHAR(36) NULL",
    "ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE notebooks ADD COLUMN parent_id VARCHAR(36) NULL",
    "ALTER TABLE notebooks ADD COLUMN category_names TEXT NULL",
]
