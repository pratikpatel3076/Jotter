import { AlertTriangle, Archive, CheckCircle2, Cloud, RefreshCw, Smartphone, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import { useNotes } from '@/hooks/useNotes'
import { useSyncStore } from '@/stores/syncStore'

export default function SyncCenterPage() {
  const { syncNow } = useNotes()
  const { state, lastSync, lastAttempt, pendingCount, failedCount, conflicts, lastError, clearConflicts } = useSyncStore()
  const healthy = state !== 'error' && pendingCount === 0 && failedCount === 0 && conflicts.length === 0

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold">Sync Center</h1>
            <p className="text-xs text-muted-foreground">Encrypted backup, devices, queues, and conflicts</p>
          </div>
          <Button size="sm" onClick={() => syncNow()}>
            <RefreshCw className={cn('h-4 w-4', state === 'syncing' && 'animate-spin')} /> Sync
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <section className={cn(
          'rounded-2xl border p-4',
          healthy ? 'border-green-800/30 bg-green-950/10' : 'border-amber-800/40 bg-amber-950/10',
        )}>
          <div className="flex items-start gap-3">
            {healthy ? <CheckCircle2 className="mt-1 h-5 w-5 text-green-400" /> : <AlertTriangle className="mt-1 h-5 w-5 text-amber-400" />}
            <div>
              <h2 className="font-semibold">{healthy ? 'Everything is synced' : 'Sync needs attention'}</h2>
              <p className="text-sm text-muted-foreground">
                {lastSync ? `Last success ${formatDate(lastSync)}` : 'No successful sync yet'}
                {lastAttempt ? ` · Last attempt ${formatDate(lastAttempt)}` : ''}
              </p>
              {lastError && <p className="mt-2 text-sm text-red-400">{lastError}</p>}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <QueueCard icon={UploadCloud} label="Pending Queue" value={pendingCount} />
          <QueueCard icon={AlertTriangle} label="Failed Items" value={failedCount} tone="danger" />
          <QueueCard icon={Archive} label="Conflicts" value={conflicts.length} tone="warning" />
          <QueueCard icon={Smartphone} label="This Device" value={navigator.onLine ? 'Online' : 'Offline'} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-surface-1 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Async Operations</h2>
            </div>
            <div className="space-y-2 text-sm">
              <StatusLine label="Startup sync" value="Enabled" />
              <StatusLine label="Online resume" value="Enabled" />
              <StatusLine label="Focus sync" value="Enabled" />
              <StatusLine label="Stale reminder" value="30 minutes" />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Conflicts</h2>
              </div>
              {conflicts.length > 0 && <Button size="sm" variant="ghost" onClick={clearConflicts}>Clear</Button>}
            </div>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conflicts recorded.</p>
            ) : (
              <div className="space-y-2">
                {conflicts.map((conflict) => (
                  <div key={`${conflict.entity_type}-${conflict.entity_id}`} className="rounded-xl bg-surface-2 p-3 text-sm">
                    <p className="font-medium">{conflict.entity_type} conflict</p>
                    <p className="text-xs text-muted-foreground">{conflict.entity_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function QueueCard({ icon: Icon, label, value, tone = 'default' }: { icon: React.ElementType; label: string; value: number | string; tone?: 'default' | 'danger' | 'warning' }) {
  return (
    <div className={cn(
      'rounded-2xl border p-4',
      tone === 'danger' ? 'border-red-800/40 bg-red-950/20' :
      tone === 'warning' ? 'border-amber-800/40 bg-amber-950/20' :
      'border-border/60 bg-surface-1',
    )}>
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
