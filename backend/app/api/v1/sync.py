from datetime import datetime, timezone
from typing import Optional
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.database import get_db
from app.models.models import User, Note, Notebook, Tag, NoteTag, Attachment, SyncLog
from app.schemas.sync import SyncPushRequest, SyncPushResponse, SyncPullResponse, ConflictResolutionRequest
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _encode_token(user_id: str) -> str:
    return f"{user_id}:{datetime.now(timezone.utc).isoformat()}"


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None


def _json_text(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value)
    except TypeError:
        return None


def _json_value(value):
    if not value:
        return []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return []
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


@router.post("/push", response_model=SyncPushResponse)
async def push_sync(
    body: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity_type = body.entity_type
    operation = body.operation
    payload = body.payload or {}
    client_id = body.entity_id

    if entity_type == "note":
        server_id = await _sync_note(db, current_user.id, client_id, operation, payload)
    elif entity_type == "notebook":
        server_id = await _sync_notebook(db, current_user.id, client_id, operation, payload)
    elif entity_type == "tag":
        server_id = await _sync_tag(db, current_user.id, client_id, operation, payload)
    elif entity_type == "attachment":
        server_id = await _sync_attachment(db, current_user.id, client_id, operation, payload)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")

    log = SyncLog(
        user_id=current_user.id,
        entity_type=entity_type,
        entity_id=server_id,
        operation=operation,
    )
    db.add(log)
    await db.commit()

    return SyncPushResponse(server_id=server_id, sync_version=1)


async def _sync_note(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Note).where(Note.client_id == client_id, Note.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
            existing.deleted_at = utcnow()
            existing.sync_version += 1
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        note = Note(
            id=str(uuid.uuid4()),
            client_id=client_id,
            user_id=user_id,
            notebook_id=payload.get("notebook_id"),
            note_type=payload.get("note_type", "rich"),
            encrypted_title=payload.get("encrypted_title"),
            encrypted_payload=payload.get("encrypted_payload", ""),
            encrypted_note_key=payload.get("encrypted_note_key"),
            encryption_version=payload.get("encryption_version", 1),
            encryption_algorithm=payload.get("encryption_algorithm", "AES-GCM"),
            iv=payload.get("iv"),
            content_hash=payload.get("content_hash"),
            color=payload.get("color"),
            source_url=payload.get("source_url"),
            category_names=_json_text(payload.get("category_names")),
            group_id=payload.get("group_id"),
            sort_order=payload.get("sort_order", 0),
            reminder_at=_parse_dt(payload.get("reminder_at")),
            due_at=_parse_dt(payload.get("due_at")),
            is_pinned=payload.get("is_pinned", False),
            is_favorite=payload.get("is_favorite", False),
            is_archived=payload.get("is_archived", False),
            is_deleted=False,
            sync_version=1,
        )
        db.add(note)
        await db.flush()
        return note.id

    if operation == "update" and existing:
        existing.encrypted_title = payload.get("encrypted_title", existing.encrypted_title)
        existing.encrypted_payload = payload.get("encrypted_payload", existing.encrypted_payload)
        existing.iv = payload.get("iv", existing.iv)
        existing.content_hash = payload.get("content_hash", existing.content_hash)
        existing.color = payload.get("color", existing.color)
        existing.source_url = payload.get("source_url", existing.source_url)
        existing.category_names = _json_text(payload.get("category_names")) if "category_names" in payload else existing.category_names
        existing.group_id = payload.get("group_id", existing.group_id)
        existing.sort_order = payload.get("sort_order", existing.sort_order)
        existing.reminder_at = _parse_dt(payload.get("reminder_at")) or existing.reminder_at
        existing.due_at = _parse_dt(payload.get("due_at")) or existing.due_at
        existing.is_pinned = payload.get("is_pinned", existing.is_pinned)
        existing.is_favorite = payload.get("is_favorite", existing.is_favorite)
        existing.is_archived = payload.get("is_archived", existing.is_archived)
        existing.notebook_id = payload.get("notebook_id", existing.notebook_id)
        existing.sync_version += 1
        return existing.id

    return client_id


async def _sync_notebook(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Notebook).where(Notebook.client_id == client_id, Notebook.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        nb = Notebook(
            client_id=client_id,
            user_id=user_id,
            parent_id=payload.get("parent_id"),
            encrypted_title=payload.get("encrypted_title", ""),
            category_names=_json_text(payload.get("category_names")),
            color=payload.get("color"),
            icon=payload.get("icon"),
            sort_order=payload.get("sort_order", 0),
            sync_version=1,
        )
        db.add(nb)
        await db.flush()
        return nb.id

    if operation == "update" and existing:
        existing.encrypted_title = payload.get("encrypted_title", existing.encrypted_title)
        existing.parent_id = payload.get("parent_id", existing.parent_id)
        existing.category_names = _json_text(payload.get("category_names")) if "category_names" in payload else existing.category_names
        existing.color = payload.get("color", existing.color)
        existing.icon = payload.get("icon", existing.icon)
        existing.sort_order = payload.get("sort_order", existing.sort_order)
        existing.sync_version += 1
        return existing.id

    return client_id


async def _sync_tag(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Tag).where(Tag.client_id == client_id, Tag.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        tag = Tag(
            client_id=client_id,
            user_id=user_id,
            encrypted_name=payload.get("encrypted_name", ""),
            color=payload.get("color"),
            sync_version=1,
        )
        db.add(tag)
        await db.flush()
        return tag.id

    if operation == "update" and existing:
        existing.encrypted_name = payload.get("encrypted_name", existing.encrypted_name)
        existing.color = payload.get("color", existing.color)
        existing.sync_version += 1
        return existing.id

    return client_id


async def _sync_attachment(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Attachment).where(Attachment.client_id == client_id, Attachment.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
            existing.sync_version += 1
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        att = Attachment(
            id=str(uuid.uuid4()),
            client_id=client_id,
            note_id=payload.get("note_id"),
            user_id=user_id,
            encrypted_file_name=payload.get("encrypted_file_name"),
            encrypted_data=payload.get("encrypted_data"),
            encrypted_search_text=payload.get("encrypted_search_text"),
            mime_type=payload.get("mime_type"),
            file_size=payload.get("file_size"),
            encrypted_file_key=payload.get("encrypted_file_key"),
            encryption_algorithm=payload.get("encryption_algorithm", "AES-GCM"),
            iv=payload.get("iv"),
            content_hash=payload.get("content_hash"),
            storage_provider=payload.get("storage_provider", "indexeddb"),
            sync_version=1,
        )
        db.add(att)
        await db.flush()
        return att.id

    if operation == "update" and existing:
        existing.encrypted_file_name = payload.get("encrypted_file_name", existing.encrypted_file_name)
        existing.encrypted_data = payload.get("encrypted_data", existing.encrypted_data)
        existing.encrypted_search_text = payload.get("encrypted_search_text", existing.encrypted_search_text)
        existing.mime_type = payload.get("mime_type", existing.mime_type)
        existing.file_size = payload.get("file_size", existing.file_size)
        existing.iv = payload.get("iv", existing.iv)
        existing.content_hash = payload.get("content_hash", existing.content_hash)
        existing.is_deleted = payload.get("is_deleted", existing.is_deleted)
        existing.sync_version += 1
        return existing.id

    return client_id


@router.get("/pull", response_model=SyncPullResponse)
async def pull_sync(
    last_sync_token: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Parse last sync time from token
    since: Optional[datetime] = None
    if last_sync_token and ":" in last_sync_token:
        try:
            since = datetime.fromisoformat(last_sync_token.split(":", 1)[1])
        except ValueError:
            pass

    note_query = select(Note).where(Note.user_id == current_user.id)
    nb_query = select(Notebook).where(Notebook.user_id == current_user.id)
    tag_query = select(Tag).where(Tag.user_id == current_user.id)
    attachment_query = select(Attachment).where(Attachment.user_id == current_user.id)

    if since:
        note_query = note_query.where(Note.updated_at > since)
        nb_query = nb_query.where(Notebook.updated_at > since)
        tag_query = tag_query.where(Tag.updated_at > since)
        attachment_query = attachment_query.where(Attachment.updated_at > since)

    notes = (await db.scalars(note_query)).all()
    notebooks = (await db.scalars(nb_query)).all()
    tags = (await db.scalars(tag_query)).all()
    attachments = (await db.scalars(attachment_query)).all()

    def note_to_dict(n: Note) -> dict:
        return {
            "id": n.id,
            "client_id": n.client_id,
            "user_id": n.user_id,
            "notebook_id": n.notebook_id,
            "note_type": n.note_type,
            "encrypted_title": n.encrypted_title,
            "encrypted_payload": n.encrypted_payload,
            "iv": n.iv,
            "content_hash": n.content_hash,
            "color": n.color,
            "source_url": n.source_url,
            "category_names": _json_value(n.category_names),
            "group_id": n.group_id,
            "sort_order": n.sort_order,
            "reminder_at": n.reminder_at.isoformat() if n.reminder_at else None,
            "due_at": n.due_at.isoformat() if n.due_at else None,
            "is_pinned": n.is_pinned,
            "is_favorite": n.is_favorite,
            "is_archived": n.is_archived,
            "is_deleted": n.is_deleted,
            "sync_version": n.sync_version,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }

    def nb_to_dict(nb: Notebook) -> dict:
        return {
            "id": nb.id,
            "client_id": nb.client_id,
            "parent_id": nb.parent_id,
            "encrypted_title": nb.encrypted_title,
            "category_names": _json_value(nb.category_names),
            "color": nb.color,
            "icon": nb.icon,
            "sort_order": nb.sort_order,
            "is_deleted": nb.is_deleted,
            "sync_version": nb.sync_version,
            "updated_at": nb.updated_at.isoformat() if nb.updated_at else None,
        }

    def tag_to_dict(t: Tag) -> dict:
        return {
            "id": t.id,
            "client_id": t.client_id,
            "encrypted_name": t.encrypted_name,
            "color": t.color,
            "is_deleted": t.is_deleted,
            "sync_version": t.sync_version,
        }

    def attachment_to_dict(a: Attachment) -> dict:
        return {
            "id": a.id,
            "client_id": a.client_id,
            "note_id": a.note_id,
            "user_id": a.user_id,
            "encrypted_file_name": a.encrypted_file_name,
            "encrypted_data": a.encrypted_data,
            "encrypted_search_text": a.encrypted_search_text,
            "mime_type": a.mime_type,
            "file_size": a.file_size,
            "encrypted_file_key": a.encrypted_file_key,
            "encryption_algorithm": a.encryption_algorithm,
            "iv": a.iv,
            "content_hash": a.content_hash,
            "storage_provider": a.storage_provider,
            "is_deleted": a.is_deleted,
            "sync_version": a.sync_version,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }

    return SyncPullResponse(
        notes=[note_to_dict(n) for n in notes],
        notebooks=[nb_to_dict(nb) for nb in notebooks],
        tags=[tag_to_dict(t) for t in tags],
        attachments=[attachment_to_dict(a) for a in attachments],
        sync_token=_encode_token(current_user.id),
    )


@router.post("/conflict")
async def resolve_conflict(
    body: ConflictResolutionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.entity_type != "note":
        return {"detail": "Conflict resolution recorded", "resolution": body.resolution}

    note = await db.scalar(select(Note).where(Note.id == body.entity_id, Note.user_id == current_user.id))
    if not note:
        note = await db.scalar(select(Note).where(Note.client_id == body.entity_id, Note.user_id == current_user.id))
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if body.resolution == "keep_server":
        return {"detail": "Server version kept", "resolution": body.resolution, "server_id": note.id}

    payload = body.payload or {}
    if body.resolution == "keep_local":
        await _apply_note_payload(note, payload)
        note.sync_version += 1
        await db.commit()
        return {"detail": "Local version applied", "resolution": body.resolution, "server_id": note.id}

    if body.resolution == "keep_both":
        clone = Note(
            id=str(uuid.uuid4()),
            client_id=payload.get("client_id") or str(uuid.uuid4()),
            user_id=current_user.id,
            notebook_id=payload.get("notebook_id", note.notebook_id),
            note_type=payload.get("note_type", note.note_type),
            encrypted_title=payload.get("encrypted_title", note.encrypted_title),
            encrypted_payload=payload.get("encrypted_payload", note.encrypted_payload),
            iv=payload.get("iv", note.iv),
            content_hash=payload.get("content_hash", note.content_hash),
            color=payload.get("color", note.color),
            source_url=payload.get("source_url", note.source_url),
            category_names=_json_text(payload.get("category_names")) if "category_names" in payload else note.category_names,
            group_id=payload.get("group_id", note.group_id),
            sort_order=payload.get("sort_order", note.sort_order),
            sync_version=1,
        )
        db.add(clone)
        await db.commit()
        return {"detail": "Both versions kept", "resolution": body.resolution, "server_id": clone.id}

    raise HTTPException(status_code=400, detail="Unknown conflict resolution")


async def _apply_note_payload(note: Note, payload: dict) -> None:
    note.encrypted_title = payload.get("encrypted_title", note.encrypted_title)
    note.encrypted_payload = payload.get("encrypted_payload", note.encrypted_payload)
    note.iv = payload.get("iv", note.iv)
    note.content_hash = payload.get("content_hash", note.content_hash)
    note.color = payload.get("color", note.color)
    note.source_url = payload.get("source_url", note.source_url)
    note.category_names = _json_text(payload.get("category_names")) if "category_names" in payload else note.category_names
    note.group_id = payload.get("group_id", note.group_id)
    note.sort_order = payload.get("sort_order", note.sort_order)
    note.reminder_at = _parse_dt(payload.get("reminder_at")) or note.reminder_at
    note.due_at = _parse_dt(payload.get("due_at")) or note.due_at
    note.is_pinned = payload.get("is_pinned", note.is_pinned)
    note.is_favorite = payload.get("is_favorite", note.is_favorite)
    note.is_archived = payload.get("is_archived", note.is_archived)
    note.notebook_id = payload.get("notebook_id", note.notebook_id)
