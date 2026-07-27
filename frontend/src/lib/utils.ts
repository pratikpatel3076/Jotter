import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined })
  }
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const NOTE_COLORS = [
  { name: 'Default', value: null, bg: 'bg-surface-2', border: 'border-border' },
  { name: 'Red', value: '#ef4444', bg: 'bg-red-950/40', border: 'border-red-800/40' },
  { name: 'Orange', value: '#f97316', bg: 'bg-orange-950/40', border: 'border-orange-800/40' },
  { name: 'Yellow', value: '#eab308', bg: 'bg-yellow-950/40', border: 'border-yellow-800/40' },
  { name: 'Green', value: '#22c55e', bg: 'bg-green-950/40', border: 'border-green-800/40' },
  { name: 'Teal', value: '#14b8a6', bg: 'bg-teal-950/40', border: 'border-teal-800/40' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-950/40', border: 'border-blue-800/40' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-950/40', border: 'border-purple-800/40' },
  { name: 'Pink', value: '#ec4899', bg: 'bg-pink-950/40', border: 'border-pink-800/40' },
]

export function getColorClasses(color: string | null): { bg: string; border: string } {
  const found = NOTE_COLORS.find((c) => c.value === color)
  return found ? { bg: found.bg, border: found.border } : { bg: 'bg-surface-2', border: 'border-border' }
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  rich: 'Rich Text',
  checklist: 'Checklist',
  task: 'Task',
  audio: 'Audio',
  photo: 'Photo',
  file: 'File',
  pdf: 'PDF',
  drawing: 'Drawing',
  webclip: 'Web Clip',
  meeting: 'Meeting',
  scan: 'Document',
}

export const NOTE_TYPE_ICONS: Record<string, string> = {
  text: 'file-text',
  rich: 'file-text',
  checklist: 'check-square',
  task: 'clipboard-list',
  audio: 'mic',
  photo: 'image',
  file: 'paperclip',
  pdf: 'file',
  drawing: 'pen-tool',
  webclip: 'globe',
  meeting: 'users',
  scan: 'scan',
}
