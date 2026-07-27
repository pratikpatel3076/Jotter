from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.db.database import create_tables
from app.api.v1.auth import router as auth_router
from app.api.v1.sync import router as sync_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.sharing import router as sharing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Encrypted notes API with offline-first sync",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(sharing_router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
