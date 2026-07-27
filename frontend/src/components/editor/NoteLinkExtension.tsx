import { Extension, type Editor } from '@tiptap/core'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import tippy, { type Instance } from 'tippy.js'
import { getAllNotes } from '@/db/vault'
import { useAuthStore } from '@/stores/authStore'

export interface NoteLink {
  id: string
  title: string
}

const NoteLinkExtension = Extension.create({
  name: 'noteLink',
  addOptions() {
    return {
      suggestion: {
        char: '[[',
        pluginKey: new PluginKey('noteLinkSuggestion'),
        allowSpaces: true,
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: NoteLink }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(`<a href="/notes/${props.id}" data-note-id="${props.id}" class="note-link">[[${props.title}]]</a> `)
            .run()
        },
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: async ({ query }: { query: string }) => {
          const userId = useAuthStore.getState().user?.id
          if (!userId) return []
          try {
            const notes = await getAllNotes()
            return notes
              .filter((n) => !n.is_deleted && n.title?.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((n) => ({ id: n.id, title: n.title || 'Untitled' }))
          } catch {
            return []
          }
        },
        render: () => {
          let component: ReactRenderer | null = null
          let popup: Instance[] | null = null

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(NoteLinkList, { props, editor: props.editor })
              if (!props.clientRect) return
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'slash-commands',
              })
            },
            onUpdate: (props: SuggestionProps) => {
              component?.updateProps(props)
              if (!props.clientRect) return
              popup?.[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') { popup?.[0].hide(); return true }
              return (component?.ref as { onKeyDown?: (p: SuggestionKeyDownProps) => boolean })?.onKeyDown?.(props) ?? false
            },
            onExit: () => { popup?.[0].destroy(); component?.destroy() },
          }
        },
      }),
    ]
  },
})

export default NoteLinkExtension

// React component for note link picker
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { FileText } from 'lucide-react'

export const NoteLinkList = forwardRef<
  { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
  SuggestionProps & { items: NoteLink[] }
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') { setSelectedIndex((i) => (i - 1 + props.items.length) % props.items.length); return true }
      if (event.key === 'ArrowDown') { setSelectedIndex((i) => (i + 1) % props.items.length); return true }
      if (event.key === 'Enter') { selectItem(selectedIndex); return true }
      return false
    },
  }))

  useEffect(() => setSelectedIndex(0), [props.items])

  function selectItem(index: number) {
    const item = props.items[index]
    if (item) props.command(item)
  }

  if (!props.items.length) {
    return (
      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px 12px', minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <p style={{ fontSize: '12px', color: 'var(--color-muted-foreground)', margin: 0 }}>No notes found</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '6px', minWidth: '220px', maxWidth: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-muted-foreground)', padding: '4px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Link to note
      </p>
      {props.items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => selectItem(idx)}
          style={{
            display: 'flex', width: '100%', alignItems: 'center', gap: '8px',
            padding: '6px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
            background: idx === selectedIndex ? 'var(--color-surface-2)' : 'transparent',
            color: 'var(--color-foreground)',
          }}
        >
          <FileText style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </span>
        </button>
      ))}
    </div>
  )
})
NoteLinkList.displayName = 'NoteLinkList'
