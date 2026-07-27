import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncConflict {
  entity_type: string
  entity_id: string
  local_version?: unknown
  server_version?: unknown
  reason?: string
}

interface SyncStore {
  state: SyncState
  lastSync: string | null
  lastAttempt: string | null
  pendingCount: number
  failedCount: number
  lastError: string | null
  syncToken: string | null
  conflicts: SyncConflict[]

  setState: (s: SyncState) => void
  setLastSync: (ts: string) => void
  setLastAttempt: (ts: string) => void
  setPendingCount: (n: number) => void
  setFailedCount: (n: number) => void
  setLastError: (e: string | null) => void
  setSyncToken: (t: string | null) => void
  setConflicts: (items: SyncConflict[]) => void
  clearConflicts: () => void
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      state: 'idle',
      lastSync: null,
      lastAttempt: null,
      pendingCount: 0,
      failedCount: 0,
      lastError: null,
      syncToken: null,
      conflicts: [],

      setState: (s) => set({ state: s }),
      setLastSync: (ts) => set({ lastSync: ts, lastError: null }),
      setLastAttempt: (ts) => set({ lastAttempt: ts }),
      setPendingCount: (n) => set({ pendingCount: n }),
      setFailedCount: (n) => set({ failedCount: n }),
      setLastError: (e) => set({ lastError: e }),
      setSyncToken: (t) => set({ syncToken: t }),
      setConflicts: (items) => set({ conflicts: items }),
      clearConflicts: () => set({ conflicts: [] }),
    }),
    {
      name: 'jotter-sync-health',
      partialize: (state) => ({
        lastSync: state.lastSync,
        lastAttempt: state.lastAttempt,
        pendingCount: state.pendingCount,
        failedCount: state.failedCount,
        lastError: state.lastError,
        syncToken: state.syncToken,
        conflicts: state.conflicts,
      }),
    },
  ),
)
