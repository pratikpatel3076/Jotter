import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MoreVertical, Pin, Star, Archive, Trash2,
  Palette, Save, Check, Clock, LayoutTemplate, Download,
  FileJson, FileText, FileType, FileCode,
  Share2, FolderInput, Tags, Info, Link2, Paperclip, ListChecks, History, ShieldCheck,
} from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { useNotesStore } from '@/stores/notesStore'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { ChecklistEditor } from '@/components/editor/ChecklistEditor'
import { PDFViewer } from '@/components/editor/PDFViewer'
import { DrawingCanvas } from '@/components/editor/DrawingCanvas'
import { AttachmentPanel } from '@/components/editor/AttachmentPanel'
import { VersionHistory } from '@/components/notes/VersionHistory'
import { TemplatesGallery } from '@/components/notes/TemplatesGallery'
import { NoteTasksPanel } from '@/components/notes/NoteTasksPanel'
import { ShareNoteDialog } from '@/components/notes/ShareNoteDialog'
import type { NoteTemplate } from '@/components/notes/TemplatesGallery'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, NOTE_COLORS, NOTE_TYPE_LABELS } from '@/lib/utils'
import type { Note, NoteType } from '@/types'
import { toast } from 'sonner'
import { exportAsJSON, exportAsHTML, exportAsPDF, exportAsMarkdown } from '@/lib/exportNote'
import { createNoteVersion } from '@/db/tasksdb'

const AUTO_SAVE_MS = 1500

function parseCategories(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 12)
}

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const noteType = (searchParams.get('type') ?? 'rich') as NoteType

  const { createNote, updateNote, deleteNote, pinNote, favoriteNote, archiveNote, getNoteById } = useNotes()
  const { notebooks, tags } = useNotesStore()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [notebookId, setNotebookId] = useState<string | null>(searchParams.get('notebook') ?? null)
  const [categoriesText, setCategoriesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty = useRef(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Load existing note
  useEffect(() => {
    if (!isNew && id) {
      getNoteById(id).then((n) => {
        if (n) {
          setNote(n)
          setTitle(n.title)
          setContent(n.content)
          setColor(n.color)
          setNotebookId(n.notebook_id)
          setCategoriesText(n.category_names.join(', '))
          setCurrentNoteId(n.id)
        }
      })
    }
  }, [id, isNew, getNoteById])

  useEffect(() => {
    if (!isNew) return
    const timer = window.setTimeout(() => titleInputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [isNew])

  useEffect(() => {
    function onScroll() {
      setHeaderScrolled(window.scrollY > 10)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const save = useCallback(async () => {
    if (!isDirty.current) return
    isDirty.current = false
    setSaving(true)
    try {
      if (currentNoteId) {
        await updateNote(currentNoteId, { title, content, color, notebook_id: notebookId, category_names: parseCategories(categoriesText) })
        // Save version snapshot
        await createNoteVersion(currentNoteId, title, content)
      } else {
        const newNote = await createNote({ title, content, note_type: noteType, color, notebook_id: notebookId, category_names: parseCategories(categoriesText) })
        setCurrentNoteId(newNote.id)
        setNote(newNote)
        // Update URL without push
        window.history.replaceState({}, '', `/notes/${newNote.id}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }, [currentNoteId, title, content, color, notebookId, categoriesText, noteType, createNote, updateNote])

  function scheduleAutoSave() {
    isDirty.current = true
    setSaved(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(save, AUTO_SAVE_MS)
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    scheduleAutoSave()
  }

  function handleContentChange(html: string, _text: string) {
    setContent(html)
    scheduleAutoSave()
  }

  function handleChecklistChange(raw: string) {
    setContent(raw)
    scheduleAutoSave()
  }

  async function handleColorChange(c: string | null) {
    setColor(c)
    setShowColorPicker(false)
    if (currentNoteId) {
      await updateNote(currentNoteId, { color: c })
    }
  }

  async function handleMoveNotebook(nextNotebookId: string | null) {
    setNotebookId(nextNotebookId)
    if (currentNoteId) {
      const updated = await updateNote(currentNoteId, { notebook_id: nextNotebookId })
      setNote(updated)
    } else {
      isDirty.current = true
    }
  }

  function handleCategoriesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCategoriesText(e.target.value)
    scheduleAutoSave()
  }

  async function handleDelete() {
    if (!currentNoteId) { navigate(-1); return }
    await deleteNote(currentNoteId)
    navigate('/dashboard')
  }

  async function handleArchive() {
    if (!currentNoteId) return
    await archiveNote(currentNoteId, true)
    navigate('/dashboard')
  }

  async function handlePin() {
    if (!currentNoteId || !note) return
    await pinNote(currentNoteId, !note.is_pinned)
    setNote((n) => n ? { ...n, is_pinned: !n.is_pinned } : n)
  }

  async function handleFavorite() {
    if (!currentNoteId || !note) return
    await favoriteNote(currentNoteId, !note.is_favorite)
    setNote((n) => n ? { ...n, is_favorite: !n.is_favorite } : n)
  }

  function handleTemplateSelect(template: NoteTemplate) {
    setTitle(template.title.replace('{Date}', new Date().toLocaleDateString()))
    setContent(template.content)
    isDirty.current = true
    scheduleAutoSave()
  }

  function handleRestoreVersion(version: import('@/types/tasks').NoteVersion) {
    setTitle(version.title)
    setContent(version.content)
    isDirty.current = true
    scheduleAutoSave()
    toast.success('Version restored')
  }

  // Save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (isDirty.current) save()
    }
  }, [save])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const visualViewport = viewport

    function updateKeyboardInset() {
      const inset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
      setKeyboardInset(inset)
      if (inset > 80) {
        window.setTimeout(() => {
          const active = document.activeElement
          if (active instanceof HTMLElement) {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }, 80)
      }
    }

    visualViewport.addEventListener('resize', updateKeyboardInset)
    visualViewport.addEventListener('scroll', updateKeyboardInset)
    document.addEventListener('focusin', updateKeyboardInset)
    updateKeyboardInset()

    return () => {
      visualViewport.removeEventListener('resize', updateKeyboardInset)
      visualViewport.removeEventListener('scroll', updateKeyboardInset)
      document.removeEventListener('focusin', updateKeyboardInset)
    }
  }, [])

  const activeColor = NOTE_COLORS.find((c) => c.value === color)
  const categoryChips = parseCategories(categoriesText)
  const currentNotebook = notebooks.find((notebook) => notebook.id === notebookId)
  const wordCount = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const charCount = content.replace(/<[^>]*>/g, '').length
  const linkedNotes = (content.match(/data-note-id=/g) ?? []).length

  return (
    <div className={cn('min-h-screen', activeColor?.bg ?? 'bg-background')}>
      {/* Toolbar */}
      <div
        className={cn(
          'sticky top-0 z-30 flex items-center gap-2 border-b border-border/40 bg-background/90 px-4 py-2.5 transition-[backdrop-filter,box-shadow] duration-300',
          headerScrolled ? 'backdrop-blur-md shadow-sm shadow-black/10' : 'backdrop-blur-0',
        )}
      >
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2 h-12 w-12">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-xs text-muted-foreground">
          {saving ? (
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" /> Saving…</span>
          ) : saved ? (
            <span className="flex items-center gap-1 text-green-400 animate-save-bounce"><Check className="h-3 w-3" /> Saved</span>
          ) : (
            <span>{NOTE_TYPE_LABELS[noteType] ?? 'Note'}</span>
          )}
          <span className="ml-2 rounded-full border border-border/50 bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {wordCount}w / {charCount}c
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Color picker */}
          <div className="relative">
            <Button variant="ghost" size="icon-sm" onClick={() => setShowColorPicker(!showColorPicker)} title="Change color">
              <Palette className="h-4 w-4" />
            </Button>
            {showColorPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-border/60 bg-surface-1 p-2 shadow-xl">
                <div className="grid grid-cols-5 gap-1.5">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleColorChange(c.value)}
                      className={cn(
                        'h-7 w-7 rounded-lg border-2 transition-all',
                        color === c.value ? 'border-primary scale-110' : 'border-transparent hover:scale-105',
                        c.value ? '' : 'bg-surface-3',
                      )}
                      style={c.value ? { background: c.value } : {}}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon-sm" onClick={save} title="Save">
            <Save className="h-4 w-4" />
          </Button>

          {/* Templates (only for new notes) */}
          {isNew && (
            <Button variant="ghost" size="icon-sm" onClick={() => setShowTemplates(true)} title="Templates">
              <LayoutTemplate className="h-4 w-4" />
            </Button>
          )}

          {/* Version history (only for saved notes) */}
          {currentNoteId && (
            <Button variant="ghost" size="icon-sm" onClick={() => setShowVersionHistory(true)} title="Version history">
              <Clock className="h-4 w-4" />
            </Button>
          )}

          {currentNoteId && (
            <Button variant="ghost" size="icon-sm" onClick={() => setShowShare(true)} title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handlePin}>
                <Pin className="h-4 w-4" /> {note?.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFavorite}>
                <Star className="h-4 w-4" /> {note?.is_favorite ? 'Unfavorite' : 'Favorite'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMoveNotebook(null)}>
                <FolderInput className="h-4 w-4" /> Move to No Notebook
              </DropdownMenuItem>
              {notebooks.filter((notebook) => !notebook.is_deleted).map((notebook) => (
                <DropdownMenuItem key={notebook.id} onClick={() => handleMoveNotebook(notebook.id)}>
                  <FolderInput className="h-4 w-4" /> {notebook.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {/* Export */}
              {note && (
                <>
                  <DropdownMenuItem onClick={() => exportAsJSON([note])}>
                    <FileJson className="h-4 w-4" /> Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsHTML(note)}>
                    <FileCode className="h-4 w-4" /> Export HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsMarkdown(note)}>
                    <FileText className="h-4 w-4" /> Export Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsPDF(note)}>
                    <Download className="h-4 w-4" /> Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem destructive onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Editor */}
      <div
        className="mx-auto grid max-w-6xl gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_280px]"
        style={{ paddingBottom: keyboardInset ? keyboardInset + 32 : undefined }}
      >
        <div className="min-w-0">
        {/* Title */}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          maxLength={120}
          onChange={handleTitleChange}
          placeholder="Note title..."
          className="mb-4 w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/30 outline-none"
        />
        {title.length > 80 && (
          <p className="-mt-3 mb-4 text-right font-mono text-[10px] text-muted-foreground/70">
            {title.length}/120
          </p>
        )}

        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-sm">
            <FolderInput className="h-4 w-4 text-muted-foreground" />
            <select
              value={notebookId ?? ''}
              onChange={(event) => handleMoveNotebook(event.target.value || null)}
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
              title="Move to notebook"
            >
              <option value="">No notebook</option>
              {notebooks.filter((notebook) => !notebook.is_deleted).map((notebook) => (
                <option key={notebook.id} value={notebook.id}>{notebook.title}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-sm">
            <Tags className="h-4 w-4 text-muted-foreground" />
            <input
              value={categoriesText}
              onChange={handleCategoriesChange}
              placeholder="Categories: work, ideas"
              className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </label>
        </div>

        {categoryChips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {categoryChips.map((category) => (
              <span key={category} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Tags className="h-3 w-3" />
                {category}
              </span>
            ))}
          </div>
        )}

        {/* Content by type */}
        {(noteType === 'rich' || noteType === 'text' || noteType === 'meeting' || noteType === 'webclip') && (
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder={noteType === 'meeting' ? 'Meeting notes. Type / for commands, [[ to link notes' : 'Type / for commands, [[ to link notes'}
          />
        )}

        {(noteType === 'checklist' || noteType === 'task') && (
          <ChecklistEditor
            content={content}
            onChange={handleChecklistChange}
          />
        )}

        {noteType === 'drawing' && (
          <DrawingCanvas
            content={content}
            onChange={(dataUrl) => { setContent(dataUrl); scheduleAutoSave() }}
          />
        )}

        {noteType === 'audio' && (
          <AudioNoteSection />
        )}

        {noteType === 'photo' && (
          <PhotoNoteSection />
        )}

        {(noteType === 'file' || noteType === 'pdf') && (
          <FileNoteSection />
        )}

        <AttachmentPanel
          noteId={currentNoteId}
          onChanged={(attachments) => setNote((n) => n ? { ...n, attachments } : n)}
        />

        <NoteTasksPanel noteId={currentNoteId} />
        </div>

        <aside className="hidden space-y-3 xl:block">
          <InfoPanel
            title="Note info"
            icon={Info}
            rows={[
              ['Type', NOTE_TYPE_LABELS[noteType] ?? 'Note'],
              ['Notebook', currentNotebook?.title ?? 'No notebook'],
              ['Words', String(wordCount)],
              ['Characters', String(charCount)],
            ]}
          />
          <InfoPanel
            title="Connections"
            icon={Link2}
            rows={[
              ['Linked notes', String(linkedNotes)],
              ['Tasks', currentNoteId ? 'Embedded' : 'Save first'],
              ['Backlinks', 'Tracked by [[links]]'],
            ]}
          />
          <InfoPanel
            title="Assets"
            icon={Paperclip}
            rows={[
              ['Attachments', String(note?.attachments?.length ?? 0)],
              ['OCR index', (note?.attachments?.length ?? 0) > 0 ? 'Ready' : 'None'],
              ['Export', 'JSON, HTML, MD, PDF'],
            ]}
          />
          <div className="rounded-2xl border border-border/60 bg-surface-1 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure actions
            </div>
            <div className="grid gap-2">
              <Button size="sm" variant="outline" onClick={save}>
                <Save className="h-4 w-4" /> Save snapshot
              </Button>
              {currentNoteId && (
                <Button size="sm" variant="ghost" onClick={() => setShowVersionHistory(true)}>
                  <History className="h-4 w-4" /> Version history
                </Button>
              )}
              {currentNoteId && (
                <Button size="sm" variant="ghost" onClick={() => setShowShare(true)}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Version History dialog */}
      {currentNoteId && (
        <VersionHistory
          noteId={currentNoteId}
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Templates gallery */}
      <TemplatesGallery
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
      />

      {currentNoteId && (
        <ShareNoteDialog
          noteId={currentNoteId}
          open={showShare}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

function AudioNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-950/40 border-2 border-red-800/40">
        <span className="text-3xl">🎤</span>
      </div>
      <p className="text-sm text-muted-foreground">Audio recording requires Capacitor on mobile</p>
      <Button variant="outline" size="sm">Attach Audio File</Button>
    </div>
  )
}

function PhotoNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-950/40 border-2 border-blue-800/40">
        <span className="text-3xl">📷</span>
      </div>
      <p className="text-sm text-muted-foreground">Camera requires Capacitor on mobile</p>
      <Button variant="outline" size="sm">Attach Photo</Button>
    </div>
  )
}

function FileNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-2 border border-border">
        <span className="text-3xl">📎</span>
      </div>
      <p className="text-sm text-muted-foreground">Attach any file to this note</p>
      <Button variant="outline" size="sm">Attach File</Button>
    </div>
  )
}

function InfoPanel({
  title,
  icon: Icon,
  rows,
}: {
  title: string
  icon: React.ElementType
  rows: Array<[string, string]>
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-surface-1 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-2.5 py-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
