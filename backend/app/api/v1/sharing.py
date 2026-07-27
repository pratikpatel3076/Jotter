from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.database import get_db
from app.models.models import Note, SharedNote, User

router = APIRouter(prefix="/sharing", tags=["sharing"])


class ShareCreate(BaseModel):
    note_id: str
    recipient_email: EmailStr
    permission: str = "view"


class ShareOut(BaseModel):
    id: str
    note_id: str
    owner_user_id: str
    recipient_email: str
    permission: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/notes/{note_id}", response_model=List[ShareOut])
async def list_note_shares(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")
    result = await db.execute(
        select(SharedNote)
        .where(SharedNote.note_id == note_id, SharedNote.status == "active")
        .order_by(SharedNote.created_at.desc())
    )
    return result.scalars().all()


@router.post("/notes", response_model=ShareOut, status_code=status.HTTP_201_CREATED)
async def share_note(
    body: ShareCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, body.note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.permission not in {"view", "edit"}:
        raise HTTPException(status_code=400, detail="Permission must be view or edit")

    existing = await db.scalar(
        select(SharedNote).where(
            SharedNote.note_id == body.note_id,
            SharedNote.recipient_email == body.recipient_email.lower(),
        )
    )
    if existing:
        existing.permission = body.permission
        existing.status = "active"
        await db.commit()
        await db.refresh(existing)
        return existing

    share = SharedNote(
        note_id=body.note_id,
        owner_user_id=current_user.id,
        recipient_email=body.recipient_email.lower(),
        permission=body.permission,
        status="active",
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    share = await db.get(SharedNote, share_id)
    if not share or share.owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")
    share.status = "revoked"
    await db.commit()
