from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.api.v1.deps import get_current_user
from app.models.models import Task, SavedSearch, NoteVersion, User

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    id: Optional[str] = None
    note_id: Optional[str] = None
    title: str
    status: str = "open"
    priority: str = "none"
    recurrence: str = "none"
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    recurrence: Optional[str] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_deleted: Optional[bool] = None


class TaskOut(BaseModel):
    id: str
    user_id: str
    note_id: Optional[str]
    title: str
    status: str
    priority: str
    recurrence: str
    due_at: Optional[datetime]
    reminder_at: Optional[datetime]
    completed_at: Optional[datetime]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SavedSearchCreate(BaseModel):
    id: Optional[str] = None
    label: str
    query: str = ""
    type_filter: Optional[str] = None
    tag_filter: Optional[str] = None


class SavedSearchOut(BaseModel):
    id: str
    user_id: str
    label: str
    query: str
    type_filter: Optional[str]
    tag_filter: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class NoteVersionOut(BaseModel):
    id: str
    note_id: str
    user_id: str
    encrypted_title: Optional[str]
    encrypted_payload: str
    sync_version: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TaskOut])
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task)
        .where(Task.user_id == current_user.id, Task.is_deleted == False)
        .order_by(Task.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = Task(
        id=body.id if body.id else None,
        user_id=current_user.id,
        note_id=body.note_id,
        title=body.title,
        status=body.status,
        priority=body.priority,
        recurrence=body.recurrence,
        due_at=body.due_at,
        reminder_at=body.reminder_at,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_deleted = True
    await db.commit()


# ── Saved Searches ────────────────────────────────────────────────────────────

@router.get("/searches", response_model=List[SavedSearchOut])
async def list_saved_searches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedSearch)
        .where(SavedSearch.user_id == current_user.id)
        .order_by(SavedSearch.created_at.desc())
    )
    return result.scalars().all()


@router.post("/searches", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
async def create_saved_search(
    body: SavedSearchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    search = SavedSearch(
        id=body.id if body.id else None,
        user_id=current_user.id,
        label=body.label,
        query=body.query,
        type_filter=body.type_filter,
        tag_filter=body.tag_filter,
    )
    db.add(search)
    await db.commit()
    await db.refresh(search)
    return search


@router.delete("/searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_search(
    search_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    search = await db.get(SavedSearch, search_id)
    if not search or search.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Search not found")
    await db.delete(search)
    await db.commit()


# ── Note Versions ─────────────────────────────────────────────────────────────

@router.get("/versions/{note_id}", response_model=List[NoteVersionOut])
async def list_note_versions(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NoteVersion)
        .where(NoteVersion.note_id == note_id, NoteVersion.user_id == current_user.id)
        .order_by(NoteVersion.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()
