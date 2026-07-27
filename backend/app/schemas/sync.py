from pydantic import BaseModel
from typing import Optional, Any


class SyncPushRequest(BaseModel):
    entity_type: str
    entity_id: str
    operation: str  # create | update | delete
    payload: Optional[Any] = None


class SyncPushResponse(BaseModel):
    server_id: str
    sync_version: int
    status: str = "synced"


class SyncPullResponse(BaseModel):
    notes: list[dict] = []
    notebooks: list[dict] = []
    tags: list[dict] = []
    note_tags: list[dict] = []
    attachments: list[dict] = []
    tasks: list[dict] = []
    calendar_events: list[dict] = []
    sync_token: str
    conflicts: list[dict] = []


class ConflictResolutionRequest(BaseModel):
    entity_type: str
    entity_id: str
    resolution: str  # keep_local | keep_server | keep_both
    payload: Optional[Any] = None
