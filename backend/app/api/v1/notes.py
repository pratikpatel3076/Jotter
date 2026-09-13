from datetime import datetime, timezone
from typing import Optional, List
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.api.v1.deps import get_current_user
from app.models.models import Note, User

router = APIRouter(prefix="/notes", tags=["notes"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    client_id: Optional[str] = None
    notebook_id: Optional[str] = None
    note_type: str = "rich"
    encrypted_title: Optional[str] = None
    encrypted_payload: str
    encrypted_note_key: Optional[str] = None
    encryption_version: int = 1
    encryption_algorithm: str = "AES-GCM"
    iv: Optional[str] = None
    content_hash: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    source_url: Optional[str] = None
    category_names: Optional[List[str]] = None
    group_id: Optional[str] = None
    sort_order: int = 0
    reminder_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    is_pinned: bool = False
    is_favorite: bool = False
    is_archived: bool = False


class NoteUpdate(BaseModel):
    client_id: Optional[str] = None
    notebook_id: Optional[str] = None
    note_type: Optional[str] = None
    encrypted_title: Optional[str] = None
    encrypted_payload: Optional[str] = None
    encrypted_note_key: Optional[str] = None
    encryption_version: Optional[int] = None
    encryption_algorithm: Optional[str] = None
    iv: Optional[str] = None
    content_hash: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    source_url: Optional[str] = None
    category_names: Optional[List[str]] = None
    group_id: Optional[str] = None
    sort_order: Optional[int] = None
    reminder_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    is_pinned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


class NoteOut(BaseModel):
    id: str
    client_id: Optional[str]
    user_id: str
    notebook_id: Optional[str]
    note_type: str
    encrypted_title: Optional[str]
    encrypted_payload: str
    encrypted_note_key: Optional[str]
    encryption_version: int
    encryption_algorithm: str
    iv: Optional[str]
    content_hash: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    source_url: Optional[str]
    category_names: Optional[str]
    group_id: Optional[str]
    sort_order: int
    reminder_at: Optional[datetime]
    due_at: Optional[datetime]
    is_pinned: bool
    is_favorite: bool
    is_archived: bool
    is_deleted: bool
    sync_version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Notes CRUD ────────────────────────────────────────────────────────────────

@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    body: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = Note(
        id=str(uuid.uuid4()),
        client_id=body.client_id,
        user_id=current_user.id,
        notebook_id=body.notebook_id,
        note_type=body.note_type,
        encrypted_title=body.encrypted_title,
        encrypted_payload=body.encrypted_payload,
        encrypted_note_key=body.encrypted_note_key,
        encryption_version=body.encryption_version,
        encryption_algorithm=body.encryption_algorithm,
        iv=body.iv,
        content_hash=body.content_hash,
        color=body.color,
        icon=body.icon,
        source_url=body.source_url,
        category_names=json.dumps(body.category_names) if body.category_names is not None else None,
        group_id=body.group_id,
        sort_order=body.sort_order,
        reminder_at=body.reminder_at,
        due_at=body.due_at,
        is_pinned=body.is_pinned,
        is_favorite=body.is_favorite,
        is_archived=body.is_archived,
        is_deleted=False,
        sync_version=1,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("", response_model=List[NoteOut])
async def list_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note)
        .where(Note.user_id == current_user.id, Note.is_deleted == False)
        .order_by(Note.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str,
    body: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")

    data = body.model_dump(exclude_unset=True)
    if "category_names" in data:
        data["category_names"] = json.dumps(data["category_names"]) if data["category_names"] is not None else None
    for field, value in data.items():
        setattr(note, field, value)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")
    note.is_deleted = True
    note.deleted_at = datetime.now(timezone.utc)
    await db.commit()