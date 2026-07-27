import { openDB, type IDBPDatabase } from 'idb'
import type {
  LocalUser,
  LocalNote,
  LocalNotebook,
  LocalTag,
  LocalNoteTag,
  LocalAttachment,
  SyncQueueItem,
} from '@/types'

const DB_NAME = 'jotter_vault'
const DB_VERSION = 1

export type JotterDB = IDBPDatabase<{
  local_users: { key: string; value: LocalUser }
  local_notes: { key: string; value: LocalNote; indexes: { by_user: string; by_notebook: string; by_sync_status: string } }
  local_notebooks: { key: string; value: LocalNotebook; indexes: { by_user: string } }
  local_tags: { key: string; value: LocalTag; indexes: { by_user: string } }
  local_note_tags: { key: [string, string]; value: LocalNoteTag; indexes: { by_note: string; by_tag: string } }
  local_attachments: { key: string; value: LocalAttachment; indexes: { by_note: string; by_user: string } }
  sync_queue: { key: string; value: SyncQueueItem; indexes: { by_status: string; by_user: string } }
}>

let dbInstance: JotterDB | null = null

export async function getDB(): Promise<JotterDB> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<{
    local_users: { key: string; value: LocalUser }
    local_notes: { key: string; value: LocalNote; indexes: { by_user: string; by_notebook: string; by_sync_status: string } }
    local_notebooks: { key: string; value: LocalNotebook; indexes: { by_user: string } }
    local_tags: { key: string; value: LocalTag; indexes: { by_user: string } }
    local_note_tags: { key: [string, string]; value: LocalNoteTag; indexes: { by_note: string; by_tag: string } }
    local_attachments: { key: string; value: LocalAttachment; indexes: { by_note: string; by_user: string } }
    sync_queue: { key: string; value: SyncQueueItem; indexes: { by_status: string; by_user: string } }
  }>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // users
      if (!db.objectStoreNames.contains('local_users')) {
        db.createObjectStore('local_users', { keyPath: 'id' })
      }

      // notes
      if (!db.objectStoreNames.contains('local_notes')) {
        const notes = db.createObjectStore('local_notes', { keyPath: 'id' })
        notes.createIndex('by_user', 'user_id')
        notes.createIndex('by_notebook', 'notebook_id')
        notes.createIndex('by_sync_status', 'sync_status')
      }

      // notebooks
      if (!db.objectStoreNames.contains('local_notebooks')) {
        const notebooks = db.createObjectStore('local_notebooks', { keyPath: 'id' })
        notebooks.createIndex('by_user', 'user_id')
      }

      // tags
      if (!db.objectStoreNames.contains('local_tags')) {
        const tags = db.createObjectStore('local_tags', { keyPath: 'id' })
        tags.createIndex('by_user', 'user_id')
      }

      // note_tags
      if (!db.objectStoreNames.contains('local_note_tags')) {
        const noteTags = db.createObjectStore('local_note_tags', { keyPath: ['note_id', 'tag_id'] })
        noteTags.createIndex('by_note', 'note_id')
        noteTags.createIndex('by_tag', 'tag_id')
      }

      // attachments
      if (!db.objectStoreNames.contains('local_attachments')) {
        const att = db.createObjectStore('local_attachments', { keyPath: 'id' })
        att.createIndex('by_note', 'note_id')
        att.createIndex('by_user', 'user_id')
      }

      // sync_queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'id' })
        sq.createIndex('by_status', 'status')
        sq.createIndex('by_user', 'user_id')
      }
    },
  })
  return dbInstance
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function saveUser(user: LocalUser): Promise<void> {
  const db = await getDB()
  await db.put('local_users', user)
}

export async function getUser(id: string): Promise<LocalUser | undefined> {
  const db = await getDB()
  return db.get('local_users', id)
}

export async function getUserByEmail(email: string): Promise<LocalUser | undefined> {
  const db = await getDB()
  const all = await db.getAll('local_users')
  return all.find((u) => u.email === email)
}

export async function clearUser(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_users', id)
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function saveNote(note: LocalNote): Promise<void> {
  const db = await getDB()
  await db.put('local_notes', note)
}

export async function getNote(id: string): Promise<LocalNote | undefined> {
  const db = await getDB()
  return db.get('local_notes', id)
}

export async function getNotesByUser(userId: string): Promise<LocalNote[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_notes', 'by_user', userId)
}

export async function getNotesByNotebook(notebookId: string): Promise<LocalNote[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_notes', 'by_notebook', notebookId)
}

export async function getPendingSyncNotes(): Promise<LocalNote[]> {
  const db = await getDB()
  const pending = await db.getAllFromIndex('local_notes', 'by_sync_status', 'pending_create')
  const updates = await db.getAllFromIndex('local_notes', 'by_sync_status', 'pending_update')
  const deletes = await db.getAllFromIndex('local_notes', 'by_sync_status', 'pending_delete')
  return [...pending, ...updates, ...deletes]
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_notes', id)
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

export async function saveNotebook(notebook: LocalNotebook): Promise<void> {
  const db = await getDB()
  await db.put('local_notebooks', notebook)
}

export async function getNotebook(id: string): Promise<LocalNotebook | undefined> {
  const db = await getDB()
  return db.get('local_notebooks', id)
}

export async function getNotebooksByUser(userId: string): Promise<LocalNotebook[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_notebooks', 'by_user', userId)
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_notebooks', id)
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function saveTag(tag: LocalTag): Promise<void> {
  const db = await getDB()
  await db.put('local_tags', tag)
}

export async function getTagsByUser(userId: string): Promise<LocalTag[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_tags', 'by_user', userId)
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_tags', id)
}

// ── Note Tags ─────────────────────────────────────────────────────────────────

export async function saveNoteTag(noteTag: LocalNoteTag): Promise<void> {
  const db = await getDB()
  await db.put('local_note_tags', noteTag)
}

export async function getNoteTagsByNote(noteId: string): Promise<LocalNoteTag[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_note_tags', 'by_note', noteId)
}

export async function deleteNoteTag(noteId: string, tagId: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_note_tags', [noteId, tagId])
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function saveAttachment(att: LocalAttachment): Promise<void> {
  const db = await getDB()
  await db.put('local_attachments', att)
}

export async function getAttachmentsByNote(noteId: string): Promise<LocalAttachment[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_attachments', 'by_note', noteId)
}

export async function getAttachmentsByUser(userId: string): Promise<LocalAttachment[]> {
  const db = await getDB()
  return db.getAllFromIndex('local_attachments', 'by_user', userId)
}

export async function getAttachment(id: string): Promise<LocalAttachment | undefined> {
  const db = await getDB()
  return db.get('local_attachments', id)
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('local_attachments', id)
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB()
  await db.put('sync_queue', item)
}

export async function getPendingSyncQueue(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('sync_queue', 'by_user', userId)
  return all.filter((i) => i.status === 'pending' || i.status === 'processing')
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB()
  await db.put('sync_queue', item)
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('sync_queue', id)
}

export async function clearDB(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('local_users'),
    db.clear('local_notes'),
    db.clear('local_notebooks'),
    db.clear('local_tags'),
    db.clear('local_note_tags'),
    db.clear('local_attachments'),
    db.clear('sync_queue'),
  ])
}
