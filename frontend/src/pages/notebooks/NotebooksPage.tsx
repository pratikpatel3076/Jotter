import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Trash2, MoreVertical, ChevronRight, Layers, Tags } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Notebook } from '@/types'

const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#ec4899']

function parseCategories(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 12)
}

export default function NotebooksPage() {
  const navigate = useNavigate()
  const { notebooks, notes, setActiveNotebook } = useNotesStore()
  const { createNotebook, updateNotebook, deleteNotebook } = useNotes()

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [newCategories, setNewCategories] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set())

  const active = useMemo(() => notebooks.filter((n) => !n.is_deleted), [notebooks])

  const noteCounts = useMemo(() =>
    active.reduce((acc, nb) => {
      acc[nb.id] = notes.filter((n) => n.notebook_id === nb.id && !n.is_deleted).length
      return acc
    }, {} as Record<string, number>),
    [active, notes],
  )

  // Separate top-level (no parent) and children
  const topLevel = active.filter((n) => !n.parent_id)
  const childrenOf = (id: string) => active.filter((n) => n.parent_id === id)

  function toggleStack(id: string) {
    setExpandedStacks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    await createNotebook(newTitle.trim(), newColor, parentId ?? undefined, parseCategories(newCategories))
    setNewTitle('')
    setNewCategories('')
    setParentId(null)
    setShowCreate(false)
    setCreating(false)
  }

  function openCreateChild(id: string) {
    setParentId(id)
    setShowCreate(true)
  }

  async function editCategories(nb: Notebook) {
    const value = window.prompt('Notebook categories', nb.category_names.join(', '))
    if (value === null) return
    await updateNotebook(nb.id, { category_names: parseCategories(value) })
  }

  function renderNotebook(nb: Notebook, depth = 0) {
    const children = childrenOf(nb.id)
    const isStack = children.length > 0
    const expanded = expandedStacks.has(nb.id)

    return (
      <div key={nb.id}>
        <div
          className={cn(
            'group relative flex items-center gap-3 rounded-2xl border border-border/60 bg-surface-2 p-4 transition-all hover:bg-surface-3 active:scale-[0.98] cursor-pointer',
            depth > 0 && 'ml-5 border-l-2',
          )}
          style={depth > 0 ? { borderLeftColor: nb.color ?? '#6366f1' } : {}}
          onClick={() => {
            if (isStack) toggleStack(nb.id)
            else { setActiveNotebook(nb.id); navigate('/dashboard') }
          }}
        >
          <div
            className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ background: (nb.color ?? '#6366f1') + '33', color: nb.color ?? '#6366f1' }}
          >
            {isStack ? <Layers className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{nb.title}</h3>
            <p className="text-xs text-muted-foreground">
              {isStack ? `${children.length} notebooks` : `${noteCounts[nb.id] ?? 0} notes`}
            </p>
            {nb.category_names.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {nb.category_names.slice(0, 3).map((category) => (
                  <span key={category} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isStack && (
            <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
          )}

          {/* Actions */}
          <div
            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-lg p-1 hover:bg-surface-1">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!nb.parent_id && (
                  <>
                    <DropdownMenuItem onClick={() => openCreateChild(nb.id)}>
                      <Plus className="h-4 w-4" /> Add to Stack
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => editCategories(nb)}>
                  <Tags className="h-4 w-4" /> Categories
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => deleteNotebook(nb.id)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Children */}
        {isStack && expanded && (
          <div className="mt-1.5 space-y-1.5 mb-1.5">
            {children.map((child) => renderNotebook(child, depth + 1))}
            <button
              onClick={() => openCreateChild(nb.id)}
              className="ml-5 flex items-center gap-2 rounded-xl border border-dashed border-border/50 px-4 py-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors w-[calc(100%-1.25rem)]"
            >
              <Plus className="h-3.5 w-3.5" /> Add notebook to stack
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <h1 className="text-lg font-extrabold">Notebooks</h1>
          <Button size="icon" variant="ghost" onClick={() => { setParentId(null); setShowCreate(true) }}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4">
        {topLevel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="mb-1 font-semibold">No notebooks yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">Organize your notes into notebooks and stacks</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Notebook
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {topLevel.map((nb) => renderNotebook(nb))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setParentId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{parentId ? 'Add Notebook to Stack' : 'New Notebook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              label="Notebook name"
              placeholder="My Notebook"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Input
              label="Categories"
              placeholder="work, research, clients"
              value={newCategories}
              onChange={(e) => setNewCategories(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/80">Color</p>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-transform',
                      newColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-surface-1' : 'hover:scale-110',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} loading={creating}>
              {parentId ? 'Add to Stack' : 'Create Notebook'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
