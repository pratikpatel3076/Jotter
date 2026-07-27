import type { Note } from '@/types'
import { stripHtml } from '@/lib/utils'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function safeFileName(title: string) {
  return (title || 'Untitled').replace(/[^a-z0-9_\-\s]/gi, '_').slice(0, 80).trim()
}

export function exportAsJSON(notes: Note[]) {
  const data = notes.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    note_type: n.note_type,
    color: n.color,
    is_pinned: n.is_pinned,
    is_favorite: n.is_favorite,
    created_at: n.created_at,
    updated_at: n.updated_at,
    tags: n.tags?.map((t) => t.name) ?? [],
  }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const label = notes.length === 1 ? safeFileName(notes[0].title) : `jotter_export_${Date.now()}`
  downloadBlob(blob, `${label}.json`)
}

export function exportAsHTML(note: Note) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${note.title || 'Untitled'}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
    h2, h3 { margin-top: 1.5em; }
    blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 1rem; color: #555; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; gap: 0.5rem; align-items: flex-start; }
  </style>
</head>
<body>
  <h1>${note.title || 'Untitled'}</h1>
  <p class="meta">Created ${new Date(note.created_at).toLocaleDateString()} · ${note.note_type}</p>
  ${note.content}
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html' })
  downloadBlob(blob, `${safeFileName(note.title)}.html`)
}

export async function exportAsPDF(note: Note) {
  // Render HTML content to a temporary off-screen element then use jsPDF + html2canvas
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;padding:40px;background:#fff;color:#000;font-family:system-ui,sans-serif;line-height:1.6;font-size:14px;'

  container.innerHTML = `
    <h1 style="font-size:24px;margin-bottom:4px;">${note.title || 'Untitled'}</h1>
    <p style="color:#666;font-size:12px;margin-bottom:24px;">${new Date(note.created_at).toLocaleDateString()}</p>
    ${note.content}
  `
  document.body.appendChild(container)

  try {
    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const ratio = canvas.width / canvas.height
    const imgH = pageW / ratio

    let y = 0
    let remaining = imgH
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 0, -y, pageW, imgH)
      remaining -= pageH
      y += pageH
      if (remaining > 0) pdf.addPage()
    }

    pdf.save(`${safeFileName(note.title)}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

export function exportAsMarkdown(note: Note) {
  // Simple HTML-to-markdown for rich notes
  let md = `# ${note.title || 'Untitled'}\n\n`
  md += `> Created: ${new Date(note.created_at).toLocaleDateString()}\n\n`

  if (note.note_type === 'checklist') {
    try {
      const data = JSON.parse(note.content)
      if (data.items) {
        data.items.forEach((item: { text: string; checked: boolean }) => {
          md += `- [${item.checked ? 'x' : ' '}] ${item.text}\n`
        })
      }
    } catch {
      md += stripHtml(note.content)
    }
  } else {
    // Basic HTML to MD conversion
    let text = note.content
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => `> ${stripHtml(c)}\n`)
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    text = text.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<[^>]+>/g, '')
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    md += text.trim()
  }

  const blob = new Blob([md], { type: 'text/markdown' })
  downloadBlob(blob, `${safeFileName(note.title)}.md`)
}
