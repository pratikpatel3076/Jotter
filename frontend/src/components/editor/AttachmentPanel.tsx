import { useEffect, useRef, useState } from 'react'
import { Download, FileText, ImageIcon, Loader2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PDFViewer } from '@/components/editor/PDFViewer'
import { cn } from '@/lib/utils'
import { createAttachment, deleteAttachment, getAttachmentBlob, getNoteAttachments } from '@/db/vault'
import { extractSearchText } from '@/lib/attachmentProcessing'
import type { Attachment } from '@/types'
import { toast } from 'sonner'

interface Props {
  noteId: string | null
  onChanged?: (attachments: Attachment[]) => void
}

export function AttachmentPanel({ noteId, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!noteId) return
    const items = await getNoteAttachments(noteId)
    setAttachments(items)
    onChanged?.(items)
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [noteId])

  async function handleFiles(files: File[]) {
    if (!noteId || files.length === 0) return
    setBusy(true)
    try {
      for (const file of files) {
        let searchText = ''
        try {
          searchText = await extractSearchText(file)
        } catch {
          toast.warning(`Attached ${file.name}, but text extraction failed`)
        }
        await createAttachment({ note_id: noteId, file, search_text: searchText })
      }
      await refresh()
      toast.success(files.length === 1 ? 'Attachment added' : `${files.length} attachments added`)
    } catch {
      toast.error('Failed to attach file')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteAttachment(id)
    await refresh()
    toast.success('Attachment removed')
  }

  return (
    <section
      className="mt-6 rounded-xl border border-border/60 bg-surface-2 p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        handleFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Attachments</h2>
          {attachments.length > 0 && <span className="text-xs text-muted-foreground">{attachments.length}</span>}
        </div>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={!noteId || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {!noteId ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
          Save the note before attaching files.
        </p>
      ) : attachments.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          Drop files here, or choose images, PDFs, and documents.
        </button>
      ) : (
        <div className="space-y-3">
          {attachments.map((att) => (
            <AttachmentItem key={att.id} attachment={att} onDelete={() => handleDelete(att.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function AttachmentItem({ attachment, onDelete }: { attachment: Attachment; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)

  useEffect(() => {
    let currentUrl: string | null = null
    getAttachmentBlob(attachment.id).then(async (blob) => {
      if (!blob) return
      currentUrl = URL.createObjectURL(blob)
      setUrl(currentUrl)
      if (attachment.mime_type === 'application/pdf') setBuffer(await blob.arrayBuffer())
    })
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [attachment.id, attachment.mime_type])

  const isImage = attachment.mime_type?.startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'

  return (
    <article className="overflow-hidden rounded-lg border border-border/60 bg-surface-1">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3 text-muted-foreground">
          {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.file_name ?? 'Attachment'}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(attachment.file_size)}{attachment.search_text ? ' · indexed' : ''}
          </p>
        </div>
        {url && (
          <a href={url} download={attachment.file_name ?? 'attachment'} className="flex-shrink-0">
            <Button variant="ghost" size="icon-sm" title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Remove">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {isImage && url && (
        <img src={url} alt="" className="max-h-72 w-full border-t border-border/40 object-contain bg-background" />
      )}
      {isPdf && buffer && (
        <PDFViewer data={buffer} fileName={attachment.file_name ?? 'document.pdf'} className="rounded-none border-x-0 border-b-0" />
      )}
      {attachment.search_text && (
        <details className="border-t border-border/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Extracted text</summary>
          <p className={cn('mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground')}>
            {attachment.search_text}
          </p>
        </details>
      )}
    </article>
  )
}

function formatBytes(value: number | null | undefined): string {
  if (!value) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
