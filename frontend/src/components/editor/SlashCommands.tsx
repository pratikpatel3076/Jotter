import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import tippy, { type Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import type { Editor } from '@tiptap/core'

export interface SlashCommand {
  title: string
  description: string
  icon: string
  category: string
  command: (editor: Editor) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Text
  { title: 'Paragraph', description: 'Plain text paragraph', icon: '¶', category: 'Text', command: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Heading 1', description: 'Large section header', icon: 'H1', category: 'Text', command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', description: 'Medium section header', icon: 'H2', category: 'Text', command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', description: 'Small section header', icon: 'H3', category: 'Text', command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  // Lists
  { title: 'Bullet List', description: 'Unordered list', icon: '•', category: 'Lists', command: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered List', description: 'Ordered list', icon: '1.', category: 'Lists', command: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Checklist', description: 'Interactive to-do list', icon: '☑', category: 'Lists', command: (e) => e.chain().focus().toggleTaskList().run() },
  // Blocks
  { title: 'Blockquote', description: 'Highlighted quote', icon: '"', category: 'Blocks', command: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Code Block', description: 'Multi-line code block', icon: '<>', category: 'Blocks', command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Divider', description: 'Horizontal rule', icon: '—', category: 'Blocks', command: (e) => e.chain().focus().setHorizontalRule().run() },
  // Inline
  { title: 'Bold', description: 'Bold text', icon: 'B', category: 'Inline', command: (e) => e.chain().focus().toggleBold().run() },
  { title: 'Italic', description: 'Italic text', icon: 'I', category: 'Inline', command: (e) => e.chain().focus().toggleItalic().run() },
  { title: 'Highlight', description: 'Highlight text', icon: '✦', category: 'Inline', command: (e) => e.chain().focus().toggleHighlight().run() },
  { title: 'Inline Code', description: 'Inline code span', icon: '`', category: 'Inline', command: (e) => e.chain().focus().toggleCode().run() },
]

const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: new PluginKey('slashCommandsSuggestion'),
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: SlashCommand }) => {
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        },
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return SLASH_COMMANDS.filter(
            (c) =>
              c.title.toLowerCase().includes(query.toLowerCase()) ||
              c.description.toLowerCase().includes(query.toLowerCase()),
          ).slice(0, 12)
        },
        render: () => {
          let component: ReactRenderer | null = null
          let popup: Instance[] | null = null

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(SlashCommandsList, { props, editor: props.editor })
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

export default SlashCommandsExtension

// React component for the popup list
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export const SlashCommandsList = forwardRef<
  { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
  SuggestionProps & { items: SlashCommand[] }
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const items = props.items as SlashCommand[]

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') { setSelectedIndex((i) => (i - 1 + items.length) % items.length); return true }
      if (event.key === 'ArrowDown') { setSelectedIndex((i) => (i + 1) % items.length); return true }
      if (event.key === 'Enter') { selectItem(selectedIndex); return true }
      return false
    },
  }))

  useEffect(() => setSelectedIndex(0), [items])

  function selectItem(index: number) {
    const item = items[index]
    if (item) props.command(item)
  }

  if (!items.length) return null

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, SlashCommand[]>)

  let globalIndex = 0

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '6px',
        minWidth: '220px',
        maxWidth: '260px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-muted-foreground)', padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {category}
          </p>
          {items.map((item) => {
            const idx = globalIndex++
            const isActive = idx === selectedIndex
            return (
              <button
                key={item.title}
                onClick={() => selectItem(idx)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: isActive ? 'var(--color-surface-2)' : 'transparent',
                  color: 'var(--color-foreground)',
                }}
              >
                <span style={{ fontSize: '14px', width: '24px', textAlign: 'center', flexShrink: 0, fontWeight: 600, color: 'var(--color-primary)' }}>
                  {item.icon}
                </span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{item.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', margin: 0 }}>{item.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
})
SlashCommandsList.displayName = 'SlashCommandsList'
