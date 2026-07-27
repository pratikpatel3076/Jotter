import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, RefreshCw, Grid3X3, List, Filter,
  FileText, CheckSquare, Mic, Image, Paperclip,
  Pin, Star, Archive, Trash2, Clock, Calendar, Globe, PenTool,
  ArrowDownAZ, Layers, LayoutGrid, Rows3, ScanSearch, UploadCloud, Keyboard,
} from 'lucide-react'
import { useNotesStore, useFilteredNotes } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { useNotes } from '@/hooks/useNotes'
import { NoteCard } from '@/components/notes/NoteCard'
import { SyncBadge } from '@/components/layout/OfflineBanner'
import { Button } from '@/components/ui/button'
import { cn, getInitials } from '@/lib/utils'
import type { NoteType } from '@/types'
import { toast } from 'sonner'

const NOTE_TYPES: Array<{ type: NoteType | null; label: string; icon: React.ElementType }> = [
  { type: null, label: 'All', icon: FileText },
  { type: 'checklist', label: 'Checklist', icon: CheckSquare },
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'photo', label: 'Photo', icon: Image },
  { type: 'file', label: 'File', icon: Paperclip },
]

const SMART_VIEWS = [
  { key: 'all', label: 'All Notes', icon: FileText },
  { key: 'pinned', label: 'Pinned', icon: Pin },
  { key: 'favorites', label: 'Favorites', icon: Star },
  { key: 'archived', label: 'Archived', icon: Archive },
  { key: 'trash', label: 'Trash', icon: Trash2 },
  { key: 'recent', label: 'Recent', icon: Clock },
]

const QUICK_ACTIONS: Array<{ label: string; type: NoteType; icon: React.ElementType; description: string }> = [
  { label: 'Write note', type: 'rich', icon: FileText, description: 'Rich text, tables, links' },
  { label: 'Checklist', type: 'checklist', icon: CheckSquare, description: 'Tasks and lists' },
  { label: 'Meeting', type: 'meeting', icon: Calendar, description: 'Agenda and action items' },
  { label: 'Web clip', type: 'webclip', icon: Globe, description: 'Save links and pages' },
  { label: 'Drawing', type: 'drawing', icon: PenTool, description: 'Sketch ideas' },
  { label: 'File note', type: 'file', icon: Paperclip, description: 'Attach files and PDFs' },
]

type SortKey = 'updated_desc' | 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc'
type Density = 'compact' | 'comfortable' | 'expanded'

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: 'Updated',
  created_desc: 'Newest',
  created_asc: 'Oldest',
  title_asc: 'A-Z',
  title_desc: 'Z-A',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { view, setView, setSearchFilters, isLoading, notebooks, activeNotebook, setActiveNotebook } = useNotesStore()
  const { syncNow, refreshAll, updateNote } = useNotes()
  const { state: syncState } = useSyncStore()
  const [activeTypeFilter, setActiveTypeFilter] = useState<NoteType | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [smartView, setSmartView] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc')
  const [density, setDensity] = useState<Density>('comfortable')
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [showFabPulse, setShowFabPulse] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const filteredNotes = useFilteredNotes()
  const categories = Array.from(new Set(filteredNotes.flatMap((note) => note.category_names))).sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    const seenPulse = localStorage.getItem('jotter-fab-pulse-seen') === '1'
    setShowFabPulse(!seenPulse)
    function onScroll() {
      setHeaderScrolled(window.scrollY > 10)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Handle smart view changes
  useEffect(() => {
    setSearchFilters({
      is_pinned: smartView === 'pinned' ? true : undefined,
      is_favorite: smartView === 'favorites' ? true : undefined,
    })
  }, [smartView, setSearchFilters])

  function handleTypeFilter(type: NoteType | null) {
    setActiveTypeFilter(type)
    setSearchFilters({ note_type: type ?? undefined })
  }

  function handleCategoryFilter(category: string | null) {
    setActiveCategory(category)
    setSearchFilters({ category: category ?? undefined })
  }

  function handleNewNote(type: NoteType = 'rich') {
    localStorage.setItem('jotter-fab-pulse-seen', '1')
    setShowFabPulse(false)
    navigate(`/notes/new?type=${type}`)
  }

  async function runPullRefresh() {
    setPullRefreshing(true)
    try {
      await syncNow()
      await refreshAll()
    } finally {
      setPullRefreshing(false)
      setPullDistance(0)
    }
  }

  function handlePullStart(event: React.TouchEvent<HTMLDivElement>) {
    if (window.scrollY > 0 || pullRefreshing) return
    pullStartY.current = event.touches[0].clientY
  }

  function handlePullMove(event: React.TouchEvent<HTMLDivElement>) {
    if (pullStartY.current === null || window.scrollY > 0 || pullRefreshing) return
    const distance = event.touches[0].clientY - pullStartY.current
    if (distance <= 0) {
      setPullDistance(0)
      return
    }
    setPullDistance(Math.min(96, distance * 0.55))
  }

  function handlePullEnd() {
    if (pullDistance >= 72 && !pullRefreshing) {
      void runPullRefresh()
      return
    }
    pullStartY.current = null
    setPullDistance(0)
  }

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortKey === 'title_asc') return a.title.localeCompare(b.title)
    if (sortKey === 'title_desc') return b.title.localeCompare(a.title)
    if (sortKey === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortKey === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const activeNotes = sortedNotes.filter((n) => !n.is_deleted && !n.is_archived)
  const todaysNotes = activeNotes.filter((n) => new Date(n.updated_at).toDateString() === new Date().toDateString())
  const attachmentNotes = activeNotes.filter((n) => (n.attachments?.length ?? 0) > 0)
  const unsyncedNotes = activeNotes.filter((n) => n.sync_status !== 'synced')

  const pinnedNotes = sortedNotes.filter((n) => n.is_pinned && !n.is_archived && !n.is_deleted)
  const otherNotes = sortedNotes.filter((n) => !n.is_pinned && !n.group_id && !n.is_archived && !n.is_deleted)
  const archivedNotes = sortedNotes.filter((n) => n.is_archived && !n.is_deleted)
  const trashedNotes = sortedNotes.filter((n) => n.is_deleted)
  const groupedNotes = sortedNotes.filter((n) => n.group_id && !n.is_archived && !n.is_deleted)

  let displayNotes = otherNotes
  if (smartView === 'pinned') displayNotes = pinnedNotes
  else if (smartView === 'archived') displayNotes = archivedNotes
  else if (smartView === 'trash') displayNotes = trashedNotes
  else if (smartView === 'all') displayNotes = sortedNotes.filter((n) => !n.is_deleted && !n.is_archived)

  async function handleDropOnNote(targetId: string) {
    if (!draggedNoteId || draggedNoteId === targetId) return
    await updateNote(draggedNoteId, { group_id: targetId })
    setDraggedNoteId(null)
    setDragTargetId(null)
    toast.success('Note grouped')
  }

  function renderNoteCard(note: (typeof displayNotes)[number]) {
    return (
      <NoteCard
        key={note.id}
        note={note}
        view={view}
        draggable
        isDragTarget={dragTargetId === note.id}
        onDragStart={() => setDraggedNoteId(note.id)}
        onDragOver={(event) => {
          event.preventDefault()
          if (draggedNoteId && draggedNoteId !== note.id) setDragTargetId(note.id)
        }}
        onDrop={() => handleDropOnNote(note.id)}
      />
    )
  }

  return (
    <div
      className="relative min-h-screen bg-background"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
      onTouchCancel={handlePullEnd}
    >
      <div
        className="pointer-events-none fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-all"
        style={{
          opacity: pullDistance > 8 || pullRefreshing ? 1 : 0,
          transform: `translate(-50%, ${pullRefreshing ? 8 : Math.max(0, pullDistance - 36)}px)`,
        }}
      >
        <RefreshCw className={cn('h-3.5 w-3.5 text-primary', (pullRefreshing || pullDistance >= 72) && 'animate-spin')} />
        {pullRefreshing ? 'Syncing' : pullDistance >= 72 ? 'Release to sync' : 'Pull to refresh'}
      </div>
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-30 border-b border-border/40 bg-background/90 transition-[background-color,backdrop-filter,box-shadow] duration-300',
          headerScrolled ? 'backdrop-blur-md shadow-sm shadow-black/10' : 'backdrop-blur-0',
        )}
      >
        <div className="mx-auto max-w-screen-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-xs font-bold text-primary">
                {user ? getInitials(user.full_name ?? user.email) : 'J'}
              </div>
              <div>
                <h1 className="text-base font-semibold leading-none">Jotter</h1>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SyncBadge />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => syncNow()}
                className={cn(syncState === 'syncing' && 'animate-spin')}
                title="Sync"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
                {view === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Notebook tabs */}
        {notebooks.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none">
            <button
              onClick={() => setActiveNotebook(null)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                !activeNotebook ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              All
            </button>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => setActiveNotebook(nb.id)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeNotebook === nb.id ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                {nb.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SmartCard icon={Clock} label="Today" value={todaysNotes.length} onClick={() => setSmartView('recent')} />
          <SmartCard icon={UploadCloud} label="Unsynced" value={unsyncedNotes.length} onClick={() => syncNow()} />
          <SmartCard icon={Paperclip} label="Attachments" value={attachmentNotes.length} onClick={() => handleTypeFilter('file')} />
          <SmartCard icon={ScanSearch} label="OCR ready" value={attachmentNotes.length} onClick={() => navigate('/search')} />
        </section>

        {activeNotes.length === 0 && (
          <section className="mb-4 rounded-2xl border border-border/60 bg-surface-1 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Setup checklist</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ChecklistStep icon={BookOpenIcon} text="Create notebook" onClick={() => navigate('/notebooks')} />
              <ChecklistStep icon={FileText} text="Write first note" onClick={() => handleNewNote()} />
              <ChecklistStep icon={Globe} text="Try web clipper" onClick={() => navigate('/clip')} />
              <ChecklistStep icon={UploadCloud} text="Connect backup" onClick={() => navigate('/settings')} />
            </div>
          </section>
        )}

        {/* Smart views */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SMART_VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSmartView(key)}
              className={cn(
                'flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                smartView === key
                  ? 'bg-primary/15 text-primary'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
            {NOTE_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleTypeFilter(type)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTypeFilter === type
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface-2 px-2 py-1 text-xs text-muted-foreground">
            <ArrowDownAZ className="h-3.5 w-3.5" />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="bg-transparent text-foreground outline-none"
              title="Sort notes"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {categories.length > 0 && (
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => handleCategoryFilter(null)}
                className={cn(
                  'flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                  !activeCategory ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                All categories
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryFilter(category)}
                  className={cn(
                    'flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                    activeCategory === category ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-border/60 bg-surface-2 p-1">
            {([
              { key: 'compact' as Density, icon: Rows3 },
              { key: 'comfortable' as Density, icon: LayoutGrid },
              { key: 'expanded' as Density, icon: Keyboard },
            ]).map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setDensity(key)}
                className={cn('rounded-lg p-1.5 text-muted-foreground hover:text-foreground', density === key && 'bg-primary/15 text-primary')}
                title={`${key} density`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <DashboardSkeletonCards />
        )}

        {/* Empty state */}
        {!isLoading && displayNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground/80">No notes yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">Create your first encrypted note or capture something useful.</p>
            <Button onClick={() => handleNewNote()} size="sm" className="mb-5">
              <Plus className="h-4 w-4" />
              Create Note
            </Button>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(({ label, type, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => handleNewNote(type)}
                  className="rounded-xl border border-border/60 bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
                >
                  <Icon className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pinned notes section */}
        {smartView === 'all' && pinnedNotes.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Pin className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pinned</h2>
            </div>
            <div className={cn(view === 'grid' ? densityGrid(density) : densityList(density))}>
              {pinnedNotes.map(renderNoteCard)}
            </div>
          </section>
        )}

        {smartView === 'all' && groupedNotes.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grouped</h2>
            </div>
            <div className={cn(view === 'grid' ? densityGrid(density) : densityList(density))}>
              {groupedNotes.map(renderNoteCard)}
            </div>
          </section>
        )}

        {/* Main notes */}
        {displayNotes.length > 0 && (
          <section>
            {smartView === 'all' && otherNotes.length > 0 && (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {activeNotebook ? notebooks.find((n) => n.id === activeNotebook)?.title : 'Recent'}
              </h2>
            )}
            <div className={cn(view === 'grid' ? densityGrid(density) : densityList(density))}>
              {(smartView === 'all' ? otherNotes : displayNotes).map(renderNoteCard)}
            </div>
          </section>
        )}
      </div>

      {/* FAB - New Note */}
      <button
        onClick={() => handleNewNote()}
        className={cn(
          'fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl',
          'bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95',
          'hover:bg-primary/90',
          showFabPulse && 'fab-pulse-ring',
        )}
        title="New Note"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

function densityGrid(density: Density) {
  if (density === 'compact') return 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5'
  if (density === 'expanded') return 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
  return 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4'
}

function densityList(density: Density) {
  return density === 'compact' ? 'space-y-1.5' : density === 'expanded' ? 'space-y-3' : 'space-y-2'
}

function DashboardSkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="skeleton-shimmer rounded-2xl border border-border/60 bg-surface-2 p-4">
          <div className="mb-4 h-4 w-2/3 rounded bg-surface-3" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-surface-3" />
            <div className="h-3 w-5/6 rounded bg-surface-3" />
            <div className="h-3 w-3/5 rounded bg-surface-3" />
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-surface-3" />
            <div className="h-2 w-2 rounded-full bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SmartCard({ icon: Icon, label, value, onClick }: { icon: React.ElementType; label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-border/60 bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  )
}

function ChecklistStep({ icon: Icon, text, onClick }: { icon: React.ElementType; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-left text-sm hover:bg-surface-3">
      <Icon className="h-4 w-4 text-primary" />
      {text}
    </button>
  )
}

const BookOpenIcon = Layers
