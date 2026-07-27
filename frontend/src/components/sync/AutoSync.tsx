import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { getPendingSyncQueue } from '@/db/indexeddb'
import { isVaultOpen } from '@/db/vault'
import { useNotes } from '@/hooks/useNotes'

const SYNC_INTERVAL_MS = 60_000
const STALE_SYNC_MS = 30 * 60_000

export function AutoSync() {
  const { user, setOffline } = useAuthStore()
  const { syncNow } = useNotes()
  const { lastSync, pendingCount, state, setPendingCount, setFailedCount, setState } = useSyncStore()
  const syncingRef = useRef(false)
  const staleToastRef = useRef(false)

  useEffect(() => {
    if (!user || !isVaultOpen()) return
    const userId = user.id

    async function refreshQueueHealth() {
      const queue = await getPendingSyncQueue(userId)
      setPendingCount(queue.filter((item) => item.status === 'pending' || item.status === 'processing').length)
      setFailedCount(queue.filter((item) => item.status === 'failed').length)
    }

    refreshQueueHealth().catch(() => {})
    const timer = window.setInterval(() => refreshQueueHealth().catch(() => {}), 15_000)
    return () => window.clearInterval(timer)
  }, [user, setPendingCount, setFailedCount])

  useEffect(() => {
    if (!user || !isVaultOpen()) return

    async function runSync(reason: 'startup' | 'interval' | 'online' | 'focus') {
      if (syncingRef.current || !navigator.onLine) return
      syncingRef.current = true
      try {
        await syncNow()
      } finally {
        syncingRef.current = false
      }
    }

    function handleOnline() {
      setOffline(false)
      runSync('online')
    }

    function handleOffline() {
      setOffline(true)
      setState('offline')
    }

    function handleFocus() {
      runSync('focus')
    }

    runSync('startup')
    const timer = window.setInterval(() => runSync('interval'), SYNC_INTERVAL_MS)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, syncNow, setOffline, setState])

  useEffect(() => {
    if (!pendingCount || state === 'syncing') {
      staleToastRef.current = false
      return
    }

    const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0
    const stale = !lastSyncTime || Date.now() - lastSyncTime > STALE_SYNC_MS
    if (stale && !staleToastRef.current) {
      staleToastRef.current = true
      toast.warning(`${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync`, {
        description: 'Keep the app online so encrypted backup can finish.',
        action: { label: 'Sync now', onClick: () => syncNow() },
      })
    }
  }, [lastSync, pendingCount, state, syncNow])

  return null
}
