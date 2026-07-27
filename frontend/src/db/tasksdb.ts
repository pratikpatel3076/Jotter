import { openDB, type IDBPDatabase } from 'idb'
import type { Task, SavedSearch, NoteVersion } from '@/types/tasks'
import { v4 as uuidv4 } from 'uuid'

const DB_NAME = 'jotter_tasks'
const DB_VERSION = 1

type TasksDB = IDBPDatabase<{
  tasks: { key: string; value: Task; indexes: { by_user: string; by_note: string; by_status: string; by_due: string } }
  saved_searches: { key: string; value: SavedSearch; indexes: { by_user: string } }
  note_versions: { key: string; value: NoteVersion; indexes: { by_note: string } }
}>

let _db: TasksDB | null = null

async function getDB(): Promise<TasksDB> {
  if (_db) return _db
  _db = await openDB<{
    tasks: { key: string; value: Task; indexes: { by_user: string; by_note: string; by_status: string; by_due: string } }
    saved_searches: { key: string; value: SavedSearch; indexes: { by_user: string } }
    note_versions: { key: string; value: NoteVersion; indexes: { by_note: string } }
  }>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tasks')) {
        const t = db.createObjectStore('tasks', { keyPath: 'id' })
        t.createIndex('by_user', 'user_id')
        t.createIndex('by_note', 'note_id')
        t.createIndex('by_status', 'status')
        t.createIndex('by_due', 'due_at')
      }
      if (!db.objectStoreNames.contains('saved_searches')) {
        const s = db.createObjectStore('saved_searches', { keyPath: 'id' })
        s.createIndex('by_user', 'user_id')
      }
      if (!db.objectStoreNames.contains('note_versions')) {
        const v = db.createObjectStore('note_versions', { keyPath: 'id' })
        v.createIndex('by_note', 'note_id')
      }
    },
  })
  return _db
}

const now = () => new Date().toISOString()

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function saveTask(task: Task): Promise<void> {
  const db = await getDB()
  await db.put('tasks', task)
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await getDB()).get('tasks', id)
}

export async function getTasksByUser(userId: string): Promise<Task[]> {
  return (await getDB()).getAllFromIndex('tasks', 'by_user', userId)
}

export async function getTasksByNote(noteId: string): Promise<Task[]> {
  return (await getDB()).getAllFromIndex('tasks', 'by_note', noteId)
}

export async function deleteTask(id: string): Promise<void> {
  await (await getDB()).delete('tasks', id)
}

export async function createTask(
  userId: string,
  input: Partial<Task> & { title: string },
): Promise<Task> {
  const task: Task = {
    id: uuidv4(),
    note_id: input.note_id ?? null,
    user_id: userId,
    title: input.title,
    description: input.description ?? null,
    status: 'open',
    priority: input.priority ?? 'none',
    due_at: input.due_at ?? null,
    reminder_at: input.reminder_at ?? null,
    recurrence: input.recurrence ?? 'none',
    recurrence_end: null,
    completed_at: null,
    tags: input.tags ?? [],
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending_create',
  }
  await saveTask(task)
  return task
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const existing = await getTask(id)
  if (!existing) throw new Error(`Task ${id} not found`)
  const updated: Task = {
    ...existing,
    ...updates,
    updated_at: now(),
    sync_status: existing.sync_status === 'pending_create' ? 'pending_create' : 'pending_update',
  }
  if (updates.status === 'done' && !existing.completed_at) {
    updated.completed_at = now()
  }
  if (updates.status === 'open') {
    updated.completed_at = null
  }
  await saveTask(updated)
  return updated
}

// ── Saved Searches ─────────────────────────────────────────────────────────

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  return (await getDB()).getAllFromIndex('saved_searches', 'by_user', userId)
}

export async function saveSavedSearch(s: SavedSearch): Promise<void> {
  await (await getDB()).put('saved_searches', s)
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await (await getDB()).delete('saved_searches', id)
}

export async function createSavedSearch(userId: string, name: string, query: string, filters: object): Promise<SavedSearch> {
  const s: SavedSearch = {
    id: uuidv4(),
    user_id: userId,
    name,
    query,
    filters: JSON.stringify(filters),
    created_at: now(),
  }
  await saveSavedSearch(s)
  return s
}

// ── Note Versions ──────────────────────────────────────────────────────────

export async function saveNoteVersion(v: NoteVersion): Promise<void> {
  await (await getDB()).put('note_versions', v)
}

export async function getNoteVersions(noteId: string): Promise<NoteVersion[]> {
  const all = await (await getDB()).getAllFromIndex('note_versions', 'by_note', noteId)
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function createNoteVersion(noteId: string, title: string, content: string): Promise<NoteVersion> {
  const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const v: NoteVersion = {
    id: uuidv4(),
    note_id: noteId,
    title,
    content,
    created_at: now(),
    word_count: wordCount,
  }
  await saveNoteVersion(v)

  // Keep only last 50 versions per note
  const all = await getNoteVersions(noteId)
  if (all.length > 50) {
    const toDelete = all.slice(50)
    const db = await getDB()
    for (const old of toDelete) await db.delete('note_versions', old.id)
  }
  return v
}
