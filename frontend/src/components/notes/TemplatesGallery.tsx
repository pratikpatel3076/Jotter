import { FileText, ListTodo, Users, BookOpen, Lightbulb, Target, Calendar, Code2, Heart, Briefcase } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface NoteTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  category: string
  color: string
  title: string
  content: string
  note_type: 'rich' | 'checklist'
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Structured notes for meetings',
    icon: Users,
    category: 'Work',
    color: '#6366f1',
    title: 'Meeting Notes — {Date}',
    note_type: 'rich',
    content: `<h2>Meeting Details</h2>
<p><strong>Date:</strong> <br><strong>Attendees:</strong> <br><strong>Purpose:</strong> </p>
<h2>Agenda</h2>
<ul><li></li><li></li></ul>
<h2>Discussion</h2>
<p></p>
<h2>Action Items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>[ Owner ] — Due: </p></div></li></ul>
<h2>Next Meeting</h2>
<p></p>`,
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    description: 'Reflect on your day',
    icon: BookOpen,
    category: 'Personal',
    color: '#22c55e',
    title: 'Journal — {Date}',
    note_type: 'rich',
    content: `<h2>How I'm feeling today</h2>
<p></p>
<h2>What happened today</h2>
<p></p>
<h2>What I'm grateful for</h2>
<ul><li></li><li></li><li></li></ul>
<h2>What I want to do tomorrow</h2>
<p></p>`,
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Plan a new project',
    icon: Target,
    category: 'Work',
    color: '#f97316',
    title: 'Project: ',
    note_type: 'rich',
    content: `<h2>Project Overview</h2>
<p><strong>Goal:</strong> <br><strong>Deadline:</strong> <br><strong>Owner:</strong> </p>
<h2>Objectives</h2>
<ul><li></li><li></li></ul>
<h2>Milestones</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Milestone 1</p></div></li></ul>
<h2>Risks</h2>
<ul><li></li></ul>
<h2>Resources</h2>
<p></p>`,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Review your week',
    icon: Calendar,
    category: 'Personal',
    color: '#a855f7',
    title: 'Weekly Review — Week of {Date}',
    note_type: 'rich',
    content: `<h2>This week's wins 🏆</h2>
<ul><li></li></ul>
<h2>What didn't go well</h2>
<ul><li></li></ul>
<h2>Key learnings</h2>
<ul><li></li></ul>
<h2>Next week's priorities</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Capture ideas freely',
    icon: Lightbulb,
    category: 'Creative',
    color: '#eab308',
    title: 'Brainstorm: ',
    note_type: 'rich',
    content: `<h2>Problem / Question</h2>
<p></p>
<h2>Ideas (no filter)</h2>
<ul><li></li><li></li><li></li><li></li><li></li></ul>
<h2>Top 3 ideas</h2>
<ol><li></li><li></li><li></li></ol>
<h2>Next steps</h2>
<p></p>`,
  },
  {
    id: 'shopping-list',
    name: 'Shopping List',
    description: 'Items to buy',
    icon: Heart,
    category: 'Personal',
    color: '#ec4899',
    title: 'Shopping List',
    note_type: 'checklist',
    content: JSON.stringify({ type: 'checklist', items: [
      { id: '1', text: '', checked: false, order: 0 },
      { id: '2', text: '', checked: false, order: 1 },
      { id: '3', text: '', checked: false, order: 2 },
    ]}),
  },
  {
    id: 'reading-notes',
    name: 'Book / Article Notes',
    description: 'Capture what you read',
    icon: BookOpen,
    category: 'Learning',
    color: '#14b8a6',
    title: 'Notes on: ',
    note_type: 'rich',
    content: `<h2>Source</h2>
<p><strong>Title:</strong> <br><strong>Author:</strong> <br><strong>Date read:</strong> </p>
<h2>Key ideas</h2>
<ul><li></li><li></li></ul>
<h2>Favourite quotes</h2>
<blockquote><p></p></blockquote>
<h2>How I can apply this</h2>
<p></p>
<h2>My rating</h2>
<p>⭐⭐⭐⭐⭐</p>`,
  },
  {
    id: 'tech-spec',
    name: 'Tech Spec',
    description: 'Technical specification',
    icon: Code2,
    category: 'Work',
    color: '#3b82f6',
    title: 'Tech Spec: ',
    note_type: 'rich',
    content: `<h2>Overview</h2>
<p></p>
<h2>Problem statement</h2>
<p></p>
<h2>Proposed solution</h2>
<p></p>
<h2>Architecture</h2>
<p></p>
<h2>API / Interface</h2>
<pre><code></code></pre>
<h2>Edge cases</h2>
<ul><li></li></ul>
<h2>Open questions</h2>
<ul><li></li></ul>`,
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep',
    description: 'Prepare for an interview',
    icon: Briefcase,
    category: 'Work',
    color: '#6366f1',
    title: 'Interview Prep: ',
    note_type: 'rich',
    content: `<h2>Company</h2>
<p><strong>Name:</strong> <br><strong>Role:</strong> <br><strong>Date:</strong> </p>
<h2>Questions to ask them</h2>
<ul><li></li><li></li></ul>
<h2>Key stories (STAR format)</h2>
<ul><li></li></ul>
<h2>Technical topics to review</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>
<h2>After the interview</h2>
<p></p>`,
  },
  {
    id: 'blank',
    name: 'Blank Note',
    description: 'Start from scratch',
    icon: FileText,
    category: 'Basic',
    color: '#71717a',
    title: '',
    note_type: 'rich',
    content: '',
  },
]

const CATEGORIES = ['All', 'Work', 'Personal', 'Creative', 'Learning', 'Basic']

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (template: NoteTemplate) => void
}

export function TemplatesGallery({ open, onClose, onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = TEMPLATES.filter(
    (t) => activeCategory === 'All' || t.category === activeCategory,
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogTitle>Choose a template</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 overflow-x-auto px-6 py-3 border-b border-border/40 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                activeCategory === cat ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((template) => {
              const Icon = template.icon
              return (
                <button
                  key={template.id}
                  onClick={() => { onSelect(template); onClose() }}
                  className="group flex flex-col rounded-xl border border-border/60 bg-surface-2 p-4 text-left transition-all hover:bg-surface-3 hover:border-primary/40 active:scale-[0.98]"
                >
                  <div
                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: template.color + '22', color: template.color }}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{template.description}</p>
                  <span className="mt-2 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted-foreground w-fit">
                    {template.category}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
