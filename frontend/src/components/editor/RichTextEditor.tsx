import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import CodeBlockLowlight from '@tiptap/extension-code-block'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import SlashCommandsExtension from './SlashCommands'
import NoteLinkExtension from './NoteLinkExtension'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, AlignLeft, AlignCenter, AlignRight, Highlighter,
  Link as LinkIcon, Image as ImageIcon, Undo, Redo, Minus,
  Table as TableIcon, Eraser, Pilcrow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  content: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}

export function RichTextEditor({ content, onChange, placeholder = 'Type / for commands, [[ to link notes', readOnly = false, className }: Props) {
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      CodeBlockLowlight,
      CharacterCount,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      SlashCommandsExtension,
      NoteLinkExtension,
    ],
    content,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange(editor.getHTML(), editor.getText())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== content) editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])

  useEffect(() => {
    if (!editor || readOnly) return

    function updateBubble() {
      const selection = editor.state.selection
      if (selection.empty) {
        setBubble(null)
        return
      }

      const start = editor.view.coordsAtPos(selection.from)
      const end = editor.view.coordsAtPos(selection.to)
      setBubble({
        top: Math.max(8, Math.min(start.top, end.top) - 44),
        left: (start.left + end.right) / 2,
      })
    }

    function hideBubble() {
      setBubble(null)
    }

    editor.on('selectionUpdate', updateBubble)
    editor.on('blur', hideBubble)
    return () => {
      editor.off('selectionUpdate', updateBubble)
      editor.off('blur', hideBubble)
    }
  }, [editor, readOnly])

  // Handle image paste
  useEffect(() => {
    if (!editor || readOnly) return
    const editorEl = editor.view.dom
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? [])
      const imageFile = files.find((f) => f.type.startsWith('image/'))
      if (!imageFile) return
      e.preventDefault()
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor.chain().focus().setImage({ src: reader.result }).run()
        }
      }
      reader.readAsDataURL(imageFile)
    }
    editorEl.addEventListener('paste', onPaste as EventListener)
    return () => editorEl.removeEventListener('paste', onPaste as EventListener)
  }, [editor, readOnly])

  return (
    <div className={cn('flex flex-col', className)}>
      {!readOnly && editor && <EditorToolbar editor={editor} />}
      {!readOnly && editor && bubble && (
        <div
          className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-border/70 bg-surface-1 p-1 shadow-xl"
          style={{ top: bubble.top, left: bubble.left }}
        >
          <BubbleButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
            <Highlighter className="h-3.5 w-3.5" />
          </BubbleButton>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none min-h-[200px] px-1 py-2',
          'focus-within:outline-none',
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/40',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          '[&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-xl',
        )}
      />
    </div>
  )
}

function BubbleButton({
  onClick, active, children, title,
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarButton({
  onClick, active, disabled, children, title,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors',
        'hover:bg-surface-3 disabled:opacity-40',
        active ? 'bg-surface-3 text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const imgInputRef = useRef<HTMLInputElement>(null)

  const setLink = useCallback(() => {
    if (!editor) return
    const url = window.prompt('URL')
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else editor.chain().focus().unsetLink().run()
  }, [editor])

  const insertImage = useCallback((file: File) => {
    if (!editor) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run()
      }
    }
    reader.readAsDataURL(file)
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border/60 bg-surface-2 p-1.5 mb-2">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border/60" />

      {/* Headings */}
      <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
        <Pilcrow className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border/60" />

      {/* Text formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code">
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear Formatting">
        <Eraser className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border/60" />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">
        <CheckSquare className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border/60" />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border/60" />

      {/* Blocks */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Table */}
      <ToolbarButton onClick={insertTable} active={editor.isActive('table')} title="Insert Table">
        <TableIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Table controls (when inside table) */}
      {editor.isActive('table') && (
        <>
          <div className="mx-1 h-4 w-px bg-border/60" />
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column">
            <span className="text-[10px] font-bold">+Col</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">
            <span className="text-[10px] font-bold">+Row</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
            <span className="text-[10px] font-bold text-destructive">-Col</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
            <span className="text-[10px] font-bold text-destructive">-Row</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
            <span className="text-[10px] font-bold text-destructive">Del</span>
          </ToolbarButton>
        </>
      )}

      {/* Image upload */}
      <ToolbarButton onClick={() => imgInputRef.current?.click()} title="Insert Image">
        <ImageIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) insertImage(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
