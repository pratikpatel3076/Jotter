import { useEffect, useState } from 'react'
import { Clock, RotateCcw, ChevronRight, FileText } from 'lucide-react'
import { getNoteVersions } from '@/db/tasksdb'
import type { NoteVersion } from '@/types/tasks'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatDate, stripHtml } from '@/lib/utils'

interface Props {
  noteId: string
  open: boolean
  onClose: () => void
  onRestore: (version: NoteVersion) => void
}

export function VersionHistory({ noteId, open, onClose, onRestore }: Props) {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [selected, setSelected] = useState<NoteVersion | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getNoteVersions(noteId).then((v) => {
      setVersions(v)
      if (v.length > 0) setSelected(v[0])
      setLoading(false)
    })
  }, [noteId, open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Version History
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center p-8">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No version history yet. Versions are saved automatically as you edit.</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Version list */}
            <div className="w-56 flex-shrink-0 border-r border-border/60 overflow-y-auto">
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/30 transition-colors hover:bg-surface-2',
                    selected?.id === v.id && 'bg-surface-2 border-l-2 border-l-primary',
                  )}
                >
                  <p className="text-xs font-medium text-foreground truncate">
                    {i === 0 ? 'Latest version' : `Version ${versions.length - i}`}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatDate(v.created_at)}</p>
                  <p className="text-[10px] text-muted-foreground">{v.word_count} words</p>
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {selected && (
                <>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
                    <div>
                      <p className="text-sm font-semibold truncate">{selected.title || 'Untitled'}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{formatDate(selected.created_at)} · {selected.word_count} words</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { onRestore(selected); onClose() }}
                      className="gap-1.5 flex-shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div
                      className="prose prose-invert prose-sm max-w-none text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: selected.content }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
