import type { NoteType } from '@/types'

export interface ImportedNote {
  title: string
  content: string
  note_type: NoteType
  color?: string | null
  tags?: string[]
}

export function importFromJSON(text: string): ImportedNote[] {
  const data = JSON.parse(text)
  const arr = Array.isArray(data) ? data : [data]
  return arr.map((item) => ({
    title: item.title ?? 'Untitled',
    content: item.content ?? '',
    note_type: (item.note_type as NoteType) ?? 'rich',
    color: item.color ?? null,
    tags: item.tags ?? [],
  }))
}

export function importFromMarkdown(fileName: string, text: string): ImportedNote {
  // Extract title from first H1 or file name
  let title = fileName.replace(/\.(md|markdown)$/i, '').replace(/_/g, ' ')
  let body = text

  const h1Match = text.match(/^#\s+(.+)/m)
  if (h1Match) {
    title = h1Match[1].trim()
    body = text.replace(h1Match[0], '').trim()
  }

  // Convert Markdown to HTML
  let html = body
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>$1</p></div></li></ul>')
    .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>$1</p></div></li></ul>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>)+/gs, (m) => `<ul>${m}</ul>`)

  // Wrap remaining text in <p> if not already block-level
  if (!html.match(/^<(h[123]|ul|ol|blockquote|p)/)) {
    html = `<p>${html}</p>`
  }

  return { title, content: html, note_type: 'rich' }
}
