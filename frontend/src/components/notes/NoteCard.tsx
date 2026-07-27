import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Pin, Star, Archive, Trash2, Copy, MoreVertical,
  BookOpen, Bell, Mic, Image, Paperclip, CheckSquare,
  FolderInput, Layers,
} from 'lucide-react'
import { cn, formatDate, truncate, stripHtml, NOTE_TYPE_LABELS } from '@/lib/utils'
import { useNotes } from '@/hooks/useNotes'
import { useNotesStore } from '@/stores/notesStore'
import type { Note } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

const TYPE_ICON: Record<string, React.ElementType> = {
  audio: Mic,
  photo: Image,
  file: Paperclip,
  checklist: CheckSquare,
  task: CheckSquare,
}

interface Props {
  note: Note
  view?: 'grid' | 'list'
  draggable?: boolean
  isDragTarget?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: () => void
}

export function NoteCard({ note, view = 'grid', draggable, isDragTarget, onDragStart, onDragOver, onDrop }: Props) {
  const navigate = useNavigate()
  const { deleteNote, pinNote, favoriteNote, archiveNote, updateNote } = useNotes()
  const { notebooks } = useNotesStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [deleteRevealed, setDeleteRevealed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggered = useRef(false)

  const preview = truncate(stripHtml(note.content), 120)
  const TypeIcon = TYPE_ICON[note.note_type]
  const typeLabel = NOTE_TYPE_LABELS[note.note_type] ?? 'Note'
  const accentStyle = note.color
    ? {
        borderLeftColor: note.color,
        background: `color-mix(in srgb, ${note.color} 7%, var(--color-surface-2))`,
      }
    : undefined

  function handleOpen() {
    if (longPressTriggered.current || deleteRevealed) {
      longPressTriggered.current = false
      return
    }
    navigate(`/notes/${note.id}`)
  }

  function clearLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
    longPressTriggered.current = false
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setMenuOpen(true)
      if (navigator.vibrate) navigator.vibrate(12)
    }, 500)
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return
    const touch = event.touches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearLongPress()
    if (view === 'list' && dx < -12 && Math.abs(dx) > Math.abs(dy)) {
      setSwipeX(Math.max(-96, dx))
    }
  }

  function handleTouchEnd() {
    clearLongPress()
    if (view === 'list') {
      setDeleteRevealed(swipeX < -56)
      setSwipeX(swipeX < -56 ? -88 : 0)
    }
    window.setTimeout(() => {
      longPressTriggered.current = false
    }, 0)
  }

  async function handleDeleteFromSwipe(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    beginDelete()
  }

  function beginDelete() {
    setDeleting(true)
    window.setTimeout(() => {
      void deleteNote(note.id)
    }, 180)
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setMenuOpen(true)
  }

  if (view === 'list') {
    return (
      <div className="relative overflow-hidden rounded-xl">
        <button
          className="absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-xl bg-red-600 text-sm font-medium text-white"
          onClick={handleDeleteFromSwipe}
        >
          Delete
        </button>
        <div
          className={cn(
            'relative flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all',
            'active:scale-[0.99] hover:bg-surface-3/40',
            'bg-surface-2 border-border border-l-[3px]',
            isDragTarget && 'ring-2 ring-primary/70',
            deleting && 'opacity-0 scale-95',
          )}
          style={{ transform: `translateX(${swipeX}px)`, ...accentStyle }}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClick={handleOpen}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-sm text-foreground">{note.title || 'Untitled'}</span>
              {note.is_pinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
              {note.is_favorite && <Star className="h-3 w-3 text-amber-400 flex-shrink-0" />}
            </div>
            {preview && <p className="mt-0.5 text-xs text-muted-foreground truncate">{preview}</p>}
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground/60">{formatDate(note.updated_at)}</span>
              <TypeChip Icon={TypeIcon} label={typeLabel} />
            </div>
          </div>
          <SyncStatusDot status={note.sync_status} />
          <NoteMenu
            note={note}
            notebooks={notebooks}
            onMove={(notebookId) => updateNote(note.id, { notebook_id: notebookId })}
            onUngroup={() => updateNote(note.id, { group_id: null })}
            onDelete={beginDelete}
            onPin={() => pinNote(note.id, !note.is_pinned)}
            onFavorite={() => favoriteNote(note.id, !note.is_favorite)}
            onArchive={() => archiveNote(note.id, true)}
            open={menuOpen}
            setOpen={setMenuOpen}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border border-l-[3px] p-4 cursor-pointer transition-all duration-200',
        'bg-surface-2 border-border active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
        note.is_pinned && 'ring-1 ring-primary/30',
        isDragTarget && 'ring-2 ring-primary/70',
        deleting && 'opacity-0 scale-95',
      )}
      style={accentStyle}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleOpen}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {TypeIcon && <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
          <h3 className="truncate text-sm font-semibold text-foreground">
            {note.title || 'Untitled'}
          </h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {note.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
          {note.is_favorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
          <div onClick={(e) => e.stopPropagation()}>
            <NoteMenu
              note={note}
              notebooks={notebooks}
              onMove={(notebookId) => updateNote(note.id, { notebook_id: notebookId })}
              onUngroup={() => updateNote(note.id, { group_id: null })}
              onDelete={beginDelete}
              onPin={() => pinNote(note.id, !note.is_pinned)}
              onFavorite={() => favoriteNote(note.id, !note.is_favorite)}
              onArchive={() => archiveNote(note.id, true)}
              open={menuOpen}
              setOpen={setMenuOpen}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {preview && (
        <p className="mb-3 flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-4">
          {preview}
        </p>
      )}

      {/* Checklist preview */}
      {note.note_type === 'checklist' && note.content && (
        <ChecklistPreview content={note.content} />
      )}

      {note.category_names.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {note.category_names.slice(0, 3).map((category) => (
            <span key={category} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/60">{formatDate(note.updated_at)}</span>
          <TypeChip Icon={TypeIcon} label={typeLabel} />
        </div>
        <div className="flex items-center gap-2">
          {note.group_id && (
            <span title="Grouped note">
              <Layers className="h-3 w-3 text-primary" />
            </span>
          )}
          {note.reminder_at && <Bell className="h-3 w-3 text-blue-400" />}
          {note.attachments && note.attachments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {note.attachments.length}
            </Badge>
          )}
          <SyncStatusDot status={note.sync_status} />
        </div>
      </div>
    </div>
  )
}

function ChecklistPreview({ content }: { content: string }) {
  let items: Array<{ text: string; checked: boolean }> = []
  try {
    const parsed = JSON.parse(content)
    if (parsed.type === 'checklist') items = parsed.items?.slice(0, 4) ?? []
  } catch { return null }

  if (!items.length) return null
  const done = items.filter((i) => i.checked).length

  const progress = Math.round((done / items.length) * 100)

  return (
    <div className="mb-3 space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className={cn('h-3.5 w-3.5 rounded flex-shrink-0 border', item.checked ? 'bg-primary border-primary' : 'border-border')} />
          <span className={cn('truncate transition-all', item.checked && 'line-through text-muted-foreground opacity-60')}>{item.text}</span>
        </div>
      ))}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" title={`${done}/${items.length} done`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function TypeChip({ Icon, label }: { Icon?: React.ElementType; label: string }) {
  const ChipIcon = Icon ?? BookOpen
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface-3/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <ChipIcon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}

function SyncStatusDot({ status }: { status: Note['sync_status'] }) {
  const label =
    status === 'synced'
      ? 'Synced'
      : status === 'conflict'
        ? 'Conflict'
        : status === 'error'
          ? 'Sync error'
          : 'Pending sync'
  return (
    <span
      className={cn(
        'h-1.5 w-1.5 flex-shrink-0 rounded-full',
        status === 'synced' && 'bg-emerald-400/80',
        (status === 'pending_create' || status === 'pending_update' || status === 'pending_delete') && 'bg-amber-400',
        (status === 'conflict' || status === 'error') && 'bg-red-400',
      )}
      title={label}
      aria-label={label}
    />
  )
}

function NoteMenu({
  note, notebooks, onMove, onUngroup, onDelete, onPin, onFavorite, onArchive, open, setOpen,
}: {
  note: Note
  notebooks: Array<{ id: string; title: string; is_deleted: boolean }>
  onMove: (notebookId: string | null) => void
  onUngroup: () => void
  onDelete: () => void
  onPin: () => void
  onFavorite: () => void
  onArchive: () => void
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const navigate = useNavigate()
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 data-[state=open]:opacity-100">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate(`/notes/${note.id}`)}>
          <BookOpen className="h-4 w-4" /> Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPin}>
          <Pin className="h-4 w-4" /> {note.is_pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFavorite}>
          <Star className="h-4 w-4" /> {note.is_favorite ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onMove(null)}>
          <FolderInput className="h-4 w-4" /> Move to No Notebook
        </DropdownMenuItem>
        {notebooks.filter((notebook) => !notebook.is_deleted).map((notebook) => (
          <DropdownMenuItem key={notebook.id} onClick={() => onMove(notebook.id)}>
            <BookOpen className="h-4 w-4" /> {notebook.title}
          </DropdownMenuItem>
        ))}
        {note.group_id && (
          <DropdownMenuItem onClick={onUngroup}>
            <Layers className="h-4 w-4" /> Remove from Group
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive}>
          <Archive className="h-4 w-4" /> Archive
        </DropdownMenuItem>
        <DropdownMenuItem destructive onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
