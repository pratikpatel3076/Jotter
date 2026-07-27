import { useCallback } from 'react'
import { useNotesStore } from '@/stores/notesStore'
import { useSyncStore } from '@/stores/syncStore'
import {
  createNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  getAllNotes,
  getNoteById,
  getAllNotebooks,
  getAllTags,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  createTag,
  getAllTags as getTagsFromVault,
  applyPulledSync,
  markEntitySynced,
} from '@/db/vault'
import { syncApi } from '@/services/api'
import { getPendingSyncQueue, updateSyncQueueItem, deleteSyncQueueItem } from '@/db/indexeddb'
import { useAuthStore } from '@/stores/authStore'
import type { NoteType } from '@/types'
import { toast } from 'sonner'

export function useNotes() {
  const { user } = useAuthStore()
  const {
    addNote,
    updateNoteInStore,
    removeNote,
    setNotes,
    setNotebooks,
    setTags,
    setLoading,
    addNotebook,
    updateNotebookInStore,
    removeNotebook,
    addTag,
  } = useNotesStore()
  const {
    setState: setSyncState,
    setPendingCount,
    setFailedCount,
    setLastAttempt,
    setLastSync,
    setLastError,
    setSyncToken,
    setConflicts,
  } = useSyncStore()

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const [notes, notebooks, tags] = await Promise.all([
        getAllNotes(),
        getAllNotebooks(),
        getTagsFromVault(),
      ])
      setNotes(notes)
      setNotebooks(notebooks)
      setTags(tags)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load notes'
      if (message.includes('Vault is locked')) {
        window.dispatchEvent(new Event('auth:logout'))
        window.location.replace('/login')
        return
      }
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [setNotes, setNotebooks, setTags, setLoading])

  const handleCreateNote = useCallback(
    async (input: { title: string; content: string; note_type?: NoteType; notebook_id?: string | null; color?: string | null; source_url?: string | null; due_at?: string | null; reminder_at?: string | null; category_names?: string[]; group_id?: string | null }) => {
      const note = await createNote(input)
      addNote(note)
      return note
    },
    [addNote],
  )

  const handleUpdateNote = useCallback(
    async (
      id: string,
      updates: Parameters<typeof updateNote>[1],
    ) => {
      const note = await updateNote(id, updates)
      updateNoteInStore(note)
      return note
    },
    [updateNoteInStore],
  )

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await softDeleteNote(id)
      removeNote(id)
      toast.success('Note moved to trash')
    },
    [removeNote],
  )

  const handleArchiveNote = useCallback(
    async (id: string, archived: boolean) => {
      const note = await updateNote(id, { is_archived: archived })
      updateNoteInStore(note)
      if (archived) removeNote(id)
    },
    [updateNoteInStore, removeNote],
  )

  const handlePinNote = useCallback(
    async (id: string, pinned: boolean) => {
      const note = await updateNote(id, { is_pinned: pinned })
      updateNoteInStore(note)
    },
    [updateNoteInStore],
  )

  const handleFavoriteNote = useCallback(
    async (id: string, favorited: boolean) => {
      const note = await updateNote(id, { is_favorite: favorited })
      updateNoteInStore(note)
    },
    [updateNoteInStore],
  )

  const handleRestoreNote = useCallback(
    async (id: string) => {
      await restoreNote(id)
      await refreshAll()
      toast.success('Note restored')
    },
    [refreshAll],
  )

  // ── Sync ──────────────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (!user) return
    if (!navigator.onLine) {
      setSyncState('offline')
      return
    }
    const attemptAt = new Date().toISOString()
    setLastAttempt(attemptAt)
    setSyncState('syncing')
    try {
      const queue = await getPendingSyncQueue(user.id)
      setPendingCount(queue.filter((item) => item.status === 'pending' || item.status === 'processing').length)
      setFailedCount(queue.filter((item) => item.status === 'failed').length)

      for (const item of queue) {
        if (item.status === 'failed') continue
        try {
          await syncApi.push({
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            operation: item.operation,
            payload: item.payload ? JSON.parse(item.payload) : null,
          }).then((resp) => markEntitySynced(item.entity_type, item.entity_id, resp.data?.server_id, resp.data?.sync_version))
          await deleteSyncQueueItem(item.id)
        } catch (e) {
          await updateSyncQueueItem({
            ...item,
            attempt_count: item.attempt_count + 1,
            last_error: String(e),
            status: item.attempt_count + 1 >= 5 ? 'failed' : 'pending',
            updated_at: new Date().toISOString(),
          })
        }
      }

      const remaining = await getPendingSyncQueue(user.id)
      setPendingCount(remaining.filter((item) => item.status === 'pending' || item.status === 'processing').length)
      setFailedCount(remaining.filter((item) => item.status === 'failed').length)
      const lastToken = localStorage.getItem('last_sync_token') ?? undefined
      const pulled = await syncApi.pull(lastToken)
      await applyPulledSync(pulled.data)
      setConflicts(pulled.data?.conflicts ?? [])
      if (pulled.data?.sync_token) {
        localStorage.setItem('last_sync_token', pulled.data.sync_token)
        setSyncToken(pulled.data.sync_token)
      }
      await refreshAll()
      setLastSync(new Date().toISOString())
      setSyncState('idle')
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Sync failed')
      setSyncState('error')
    }
  }, [user, setSyncState, setPendingCount, setFailedCount, setLastAttempt, setLastSync, setLastError, setSyncToken, setConflicts, refreshAll])

  // ── Notebooks ─────────────────────────────────────────────────────────────

  const handleCreateNotebook = useCallback(
    async (title: string, color?: string, parentId?: string, categoryNames: string[] = []) => {
      const nb = await createNotebook(title, color, undefined, parentId, categoryNames)
      addNotebook(nb)
      return nb
    },
    [addNotebook],
  )

  const handleUpdateNotebook = useCallback(
    async (id: string, updates: Parameters<typeof updateNotebook>[1]) => {
      const nb = await updateNotebook(id, updates)
      updateNotebookInStore(nb)
      return nb
    },
    [updateNotebookInStore],
  )

  const handleDeleteNotebook = useCallback(
    async (id: string) => {
      await deleteNotebook(id)
      removeNotebook(id)
    },
    [removeNotebook],
  )

  // ── Tags ──────────────────────────────────────────────────────────────────

  const handleCreateTag = useCallback(
    async (name: string, color?: string) => {
      const tag = await createTag(name, color)
      addTag(tag)
      return tag
    },
    [addTag],
  )

  return {
    refreshAll,
    createNote: handleCreateNote,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
    archiveNote: handleArchiveNote,
    pinNote: handlePinNote,
    favoriteNote: handleFavoriteNote,
    restoreNote: handleRestoreNote,
    syncNow,
    createNotebook: handleCreateNotebook,
    updateNotebook: handleUpdateNotebook,
    deleteNotebook: handleDeleteNotebook,
    createTag: handleCreateTag,
    getNoteById,
  }
}
