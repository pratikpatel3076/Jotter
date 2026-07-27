import { useState } from 'react'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TAG_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#ec4899', '#3b82f6']

export default function TagsPage() {
  const { tags, notes } = useNotesStore()
  const { createTag } = useNotes()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])
  const [creating, setCreating] = useState(false)

  const tagCounts = tags.reduce((acc, t) => {
    acc[t.id] = notes.filter((n) => n.tags?.some((nt) => nt.id === t.id)).length
    return acc
  }, {} as Record<string, number>)

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    await createTag(newName.trim(), newColor)
    setNewName('')
    setShowCreate(false)
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <h1 className="text-lg font-extrabold">Tags</h1>
          <Button size="icon" variant="ghost" onClick={() => setShowCreate(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <Tag className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="mb-1 font-semibold">No tags yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">Add tags to organize your notes</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Tag
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.filter((t) => !t.is_deleted).map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ background: tag.color ?? '#6366f1' }} />
                  <span className="font-medium text-sm">{tag.name}</span>
                </div>
                <Badge variant="secondary">{tagCounts[tag.id] ?? 0}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              label="Tag name"
              placeholder="work, personal, ideas…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/80">Color</p>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
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
              Create Tag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
