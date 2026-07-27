import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/types'

interface Props {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
}

export function ChecklistEditor({ content, onChange, readOnly = false }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    try {
      const parsed = JSON.parse(content)
      if (parsed.type === 'checklist') return parsed.items ?? []
    } catch { }
    return []
  })

  const emit = useCallback(
    (newItems: ChecklistItem[]) => {
      onChange(JSON.stringify({ type: 'checklist', items: newItems }))
    },
    [onChange],
  )

  function toggle(id: string) {
    if (readOnly) return
    const updated = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    setItems(updated)
    emit(updated)
  }

  function updateText(id: string, text: string) {
    const updated = items.map((i) => (i.id === id ? { ...i, text } : i))
    setItems(updated)
    emit(updated)
  }

  function addItem() {
    const newItem: ChecklistItem = { id: uuidv4(), text: '', checked: false, order: items.length }
    const updated = [...items, newItem]
    setItems(updated)
    emit(updated)
  }

  function removeItem(id: string) {
    const updated = items.filter((i) => i.id !== id)
    setItems(updated)
    emit(updated)
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
    if (e.key === 'Backspace') {
      const item = items.find((i) => i.id === id)
      if (item && item.text === '' && items.length > 1) {
        removeItem(id)
      }
    }
  }

  const done = items.filter((i) => i.checked).length

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="mb-1 text-xs text-muted-foreground">
          {done}/{items.length} completed
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2">
            {!readOnly && (
              <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40 cursor-grab" />
            )}
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={cn(
                'flex-shrink-0 h-4.5 w-4.5 rounded border-2 transition-all',
                item.checked
                  ? 'border-primary bg-primary'
                  : 'border-border/60 hover:border-primary/50',
              )}
            >
              {item.checked && (
                <svg viewBox="0 0 12 12" className="h-full w-full text-white p-0.5">
                  <polyline points="1,6 5,10 11,2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {readOnly ? (
              <span className={cn('text-sm flex-1 transition-all', item.checked && 'line-through text-muted-foreground opacity-60')}>
                {item.text || 'Empty item'}
              </span>
            ) : (
              <input
                type="text"
                value={item.text}
                onChange={(e) => updateText(item.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                placeholder="Add item…"
                className={cn(
                  'flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40',
                  'transition-all',
                  item.checked && 'line-through text-muted-foreground opacity-60',
                )}
              />
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-950/40 transition-opacity"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      )}
    </div>
  )
}
