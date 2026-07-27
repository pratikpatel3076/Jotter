import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity, AlertTriangle, Archive, BookOpen, Calendar, CheckSquare, Cloud, Command,
  FileText, Gauge, Home, Keyboard, Layers, Palette, Paperclip, Plus, RefreshCw,
  Search, Settings, Sparkles, Tags, X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import { useNotesStore } from '@/stores/notesStore'
import { useSyncStore } from '@/stores/syncStore'
import { useNotes } from '@/hooks/useNotes'

const PRIMARY_ACTIONS = [
  { label: 'New rich note', icon: FileText, to: '/notes/new?type=rich', hint: 'N' },
  { label: 'New checklist', icon: CheckSquare, to: '/notes/new?type=checklist', hint: 'C' },
  { label: 'Meeting note', icon: Calendar, to: '/notes/new?type=meeting', hint: 'M' },
  { label: 'Web clip', icon: Sparkles, to: '/clip', hint: 'W' },
]

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/notebooks', icon: BookOpen, label: 'Notebooks' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/sync', icon: Cloud, label: 'Sync Center' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function AppChromeEnhancements() {
  const navigate = useNavigate()
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const { syncNow } = useNotes()
  const { notes, notebooks, tags, activeNotebook, setActiveNotebook } = useNotesStore()
  const sync = useSyncStore()

  const activeNotes = notes.filter((note) => !note.is_deleted)
  const stats = useMemo(() => ({
    notes: activeNotes.length,
    notebooks: notebooks.filter((notebook) => !notebook.is_deleted).length,
    tasks: notes.filter((note) => note.note_type === 'task' || note.note_type === 'checklist').length,
    attachments: notes.reduce((count, note) => count + (note.attachments?.length ?? 0), 0),
    categories: new Set(notes.flatMap((note) => note.category_names)).size,
  }), [activeNotes.length, notebooks, notes])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (event.key === '?') {
        const target = event.target as HTMLElement | null
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        setShortcutsOpen(true)
      }
      if ((event.ctrlKey || event.metaKey) && key === 'n') {
        event.preventDefault()
        navigate('/notes/new?type=rich')
      }
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        syncNow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, syncNow])

  function go(path: string) {
    setCommandOpen(false)
    navigate(path)
  }

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-64 border-r border-border/60 bg-surface-1/95 px-3 py-4 backdrop-blur-md lg:block">
        <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Jotter</p>
            <p className="text-xs text-muted-foreground">Encrypted workspace</p>
          </div>
        </div>

        <button
          onClick={() => setCommandOpen(true)}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
        >
          <Command className="h-4 w-4" />
          Command palette
          <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 text-[10px]">Ctrl K</span>
        </button>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 rounded-xl border border-border/60 bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> Workspace
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric icon={FileText} label="Notes" value={stats.notes} />
            <Metric icon={BookOpen} label="Books" value={stats.notebooks} />
            <Metric icon={Paperclip} label="Files" value={stats.attachments} />
            <Metric icon={Tags} label="Cats" value={stats.categories} />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase text-muted-foreground">
            <span>Notebooks</span>
            <BookOpen className="h-3.5 w-3.5" />
          </div>
          <div className="max-h-48 space-y-1 overflow-auto pr-1">
            <button
              onClick={() => { setActiveNotebook(null); navigate('/dashboard') }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
                !activeNotebook ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-2',
              )}
            >
              <Layers className="h-3.5 w-3.5" /> All notes
            </button>
            {notebooks.filter((notebook) => !notebook.is_deleted).slice(0, 12).map((notebook) => (
              <button
                key={notebook.id}
                onClick={() => { setActiveNotebook(notebook.id); navigate('/dashboard') }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
                  activeNotebook === notebook.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-2',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: notebook.color ?? '#6366f1' }} />
                <span className="truncate">{notebook.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 left-3 right-3 space-y-2">
          <button
            onClick={() => setActivityOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <Activity className="h-4 w-4" />
            Sync activity
            {(sync.pendingCount > 0 || sync.failedCount > 0 || sync.conflicts.length > 0) && (
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                {sync.pendingCount + sync.failedCount + sync.conflicts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <Keyboard className="h-4 w-4" /> Keyboard shortcuts
          </button>
        </div>
      </aside>

      <div className="fixed bottom-24 left-4 z-40 flex flex-col gap-2 lg:hidden">
        <button
          onClick={() => setCommandOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-1 shadow-lg"
          title="Command palette"
        >
          <Command className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActivityOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-1 shadow-lg"
          title="Activity"
        >
          <Activity className="h-5 w-5" />
        </button>
      </div>

      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="flex items-center gap-2"><Command className="h-4 w-4" /> Command Palette</DialogTitle>
          </DialogHeader>
          <div className="p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {PRIMARY_ACTIONS.map(({ label, icon: Icon, to, hint }) => (
                <button key={label} onClick={() => go(to)} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2 p-3 text-left hover:bg-surface-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
                  <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <button key={to} onClick={() => go(to)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </button>
              ))}
              <button onClick={() => { setCommandOpen(false); syncNow() }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                Sync now
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Keyboard className="h-4 w-4" /> Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            <Shortcut keys="Ctrl K" label="Open command palette" />
            <Shortcut keys="Ctrl N" label="Create note" />
            <Shortcut keys="Ctrl S" label="Sync now" />
            <Shortcut keys="?" label="Show shortcuts" />
            <Shortcut keys="/" label="Editor slash menu" />
            <Shortcut keys="[[" label="Link another note" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Activity & Sync Center</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <StatusTile icon={Cloud} label="Pending" value={sync.pendingCount} />
              <StatusTile icon={AlertTriangle} label="Failed" value={sync.failedCount} tone="danger" />
              <StatusTile icon={Archive} label="Conflicts" value={sync.conflicts.length} tone="warning" />
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2 p-3 text-sm">
              <p className="font-medium">Sync status</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {sync.lastSync ? `Last successful sync ${formatDate(sync.lastSync)}` : 'No successful sync yet'}
              </p>
              {sync.lastAttempt && <p className="text-xs text-muted-foreground">Last attempt {formatDate(sync.lastAttempt)}</p>}
              {sync.lastError && <p className="mt-2 text-xs text-red-400">{sync.lastError}</p>}
              <Button className="mt-3 w-full" size="sm" onClick={() => syncNow()}>
                <RefreshCw className="h-4 w-4" /> Sync now
              </Button>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2 p-3">
              <p className="mb-2 text-sm font-medium">Recent activity</p>
              <ActivityLine icon={Palette} text="UI customization ready" />
              <ActivityLine icon={Paperclip} text={`${stats.attachments} attachment${stats.attachments === 1 ? '' : 's'} indexed`} />
              <ActivityLine icon={Tags} text={`${tags.length} tag${tags.length === 1 ? '' : 's'} available`} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <p className="mt-0.5 font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
      <span>{label}</span>
      <kbd className="rounded bg-background px-2 py-1 text-xs text-muted-foreground">{keys}</kbd>
    </div>
  )
}

function StatusTile({ icon: Icon, label, value, tone = 'default' }: { icon: React.ElementType; label: string; value: number; tone?: 'default' | 'danger' | 'warning' }) {
  return (
    <div className={cn(
      'rounded-xl border p-3 text-center',
      tone === 'danger' ? 'border-red-800/40 bg-red-950/20' :
      tone === 'warning' ? 'border-amber-800/40 bg-amber-950/20' :
      'border-border/60 bg-surface-2',
    )}>
      <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ActivityLine({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-border/40 py-2 text-xs first:border-t-0">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  )
}
