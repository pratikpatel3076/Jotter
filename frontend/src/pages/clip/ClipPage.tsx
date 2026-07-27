import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Globe, Loader2, Plus } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function ClipPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { createNote } = useNotes()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [url, setUrl] = useState(params.get('url') ?? '')
  const [text, setText] = useState(params.get('text') ?? '')

  const initialClip = useMemo(() => {
    const sharedText = params.get('text') ?? ''
    const sharedUrl = params.get('url') ?? extractUrl(sharedText) ?? ''
    return {
      title: params.get('title') || sharedUrl || 'Web clip',
      url: sharedUrl,
      content: params.get('html') || buildClipHtml(sharedText, sharedUrl),
    }
  }, [params])

  useEffect(() => {
    if (!params.toString()) return
    handleSave(initialClip.title, initialClip.url, initialClip.content)
  }, [])

  async function handleSave(nextTitle = title, nextUrl = url, nextContent = buildClipHtml(text, url)) {
    setSaving(true)
    try {
      const note = await createNote({
        title: nextTitle || nextUrl || 'Web clip',
        content: nextContent,
        note_type: 'webclip',
      })
      toast.success('Web clip saved')
      navigate(`/notes/${note.id}`, { replace: true })
    } catch {
      toast.error('Failed to save web clip')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-screen-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold">New Web Clip</h1>
            <p className="text-sm text-muted-foreground">Save a page, link, or selected text.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
          <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground/80">Content</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Selected text or notes"
              rows={8}
              className="w-full resize-y rounded-xl border border-border/60 bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button className="w-full" onClick={() => handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Clip
          </Button>
        </div>
      </div>
    </div>
  )
}

function buildClipHtml(text: string, url: string): string {
  const parts = []
  if (url) {
    parts.push(`<p><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`)
  }
  if (text) {
    parts.push(`<blockquote><p>${escapeHtml(text).replace(/\n+/g, '</p><p>')}</p></blockquote>`)
  }
  return parts.join('\n') || '<p></p>'
}

function extractUrl(value: string): string | null {
  return value.match(/https?:\/\/\S+/)?.[0] ?? null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
