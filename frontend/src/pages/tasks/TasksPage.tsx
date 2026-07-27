import { useEffect, useState, useMemo } from 'react'
import {
  Plus, CheckCircle2, Circle, Clock, AlertTriangle,
  Calendar, Flag, MoreVertical, Trash2, ArrowUpDown,
  ListTodo, Filter, ChevronDown, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTasksStore } from '@/stores/tasksStore'
import { scheduleReminder } from '@/lib/notifications'
import {
  getTasksByUser, createTask, updateTask, deleteTask,
} from '@/db/tasksdb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatDate } from '@/lib/utils'
import type { Task, TaskPriority, TaskStatus, RecurrenceType } from '@/types/tasks'
import { toast } from 'sonner'

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: 'None', color: 'text-muted-foreground', icon: <Circle className="h-3.5 w-3.5" /> },
  low: { label: 'Low', color: 'text-blue-400', icon: <Flag className="h-3.5 w-3.5 text-blue-400" /> },
  medium: { label: 'Medium', color: 'text-amber-400', icon: <Flag className="h-3.5 w-3.5 text-amber-400" /> },
  high: { label: 'High', color: 'text-red-400', icon: <Flag className="h-3.5 w-3.5 text-red-400" /> },
}

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

type SortKey = 'due_at' | 'priority' | 'created_at' | 'title'
type FilterView = 'all' | 'today' | 'upcoming' | 'overdue' | 'done'
type PageView = 'list' | 'calendar'

export default function TasksPage() {
  const { user } = useAuthStore()
  const { tasks, setTasks, addTask, updateTaskInStore, removeTask } = useTasksStore()
  const [showCreate, setShowCreate] = useState(false)
  const [filterView, setFilterView] = useState<FilterView>('all')
  const [sortKey, setSortKey] = useState<SortKey>('due_at')
  const [loading, setLoading] = useState(true)
  const [pageView, setPageView] = useState<PageView>('list')

  useEffect(() => {
    if (!user) return
    getTasksByUser(user.id).then((t) => { setTasks(t); setLoading(false) })
  }, [user, setTasks])

  const filtered = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    let list = tasks.filter((t) => t.status !== 'cancelled')
    switch (filterView) {
      case 'today':
        list = list.filter((t) => t.due_at && t.due_at.slice(0, 10) === todayStr && t.status !== 'done')
        break
      case 'upcoming':
        list = list.filter((t) => t.due_at && t.due_at > todayStr && t.status !== 'done')
        break
      case 'overdue':
        list = list.filter((t) => t.due_at && t.due_at < todayStr && t.status !== 'done')
        break
      case 'done':
        list = list.filter((t) => t.status === 'done')
        break
      default:
        list = list.filter((t) => t.status !== 'done')
    }
    return list.sort((a, b) => {
      if (sortKey === 'due_at') {
        if (!a.due_at && !b.due_at) return 0
        if (!a.due_at) return 1
        if (!b.due_at) return -1
        return a.due_at.localeCompare(b.due_at)
      }
      if (sortKey === 'priority') {
        const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2, none: 3 }
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
      }
      if (sortKey === 'title') return a.title.localeCompare(b.title)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [tasks, filterView, sortKey])

  const counts = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10)
    return {
      today: tasks.filter((t) => t.due_at?.slice(0, 10) === now && t.status === 'open').length,
      overdue: tasks.filter((t) => t.due_at && t.due_at < now && t.status === 'open').length,
      upcoming: tasks.filter((t) => t.due_at && t.due_at > now && t.status === 'open').length,
    }
  }, [tasks])

  async function handleToggle(task: Task) {
    const updated = await updateTask(task.id, {
      status: task.status === 'done' ? 'open' : 'done',
    })
    updateTaskInStore(updated)
  }

  async function handleDelete(id: string) {
    await deleteTask(id)
    removeTask(id)
    toast.success('Task deleted')
  }

  const views: Array<{ key: FilterView; label: string; count?: number }> = [
    { key: 'all', label: 'All Open' },
    { key: 'today', label: 'Today', count: counts.today },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { key: 'done', label: 'Completed' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <h1 className="text-lg font-extrabold">Tasks</h1>
          <div className="flex items-center gap-2">
            {/* List / Calendar toggle */}
            <div className="flex rounded-lg border border-border/60 bg-surface-2 overflow-hidden">
              <button
                onClick={() => setPageView('list')}
                className={cn('flex h-8 w-8 items-center justify-center transition-colors', pageView === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}
                title="List view"
              >
                <ListTodo className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPageView('calendar')}
                className={cn('flex h-8 w-8 items-center justify-center transition-colors', pageView === 'calendar' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}
                title="Calendar view"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['due_at', 'priority', 'title', 'created_at'] as SortKey[]).map((k) => (
                  <DropdownMenuItem key={k} onClick={() => setSortKey(k)}>
                    {sortKey === k && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    {k === 'due_at' ? 'By due date' : k === 'priority' ? 'By priority' : k === 'title' ? 'By title' : 'By created'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
        {pageView === 'list' && (
          <>
            {/* Filter tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {views.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilterView(key)}
                  className={cn(
                    'flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                    filterView === key
                      ? key === 'overdue' ? 'bg-red-950/40 text-red-400' : 'bg-primary/15 text-primary'
                      : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {count != null && count > 0 && (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      key === 'overdue' ? 'bg-red-900/60 text-red-300' : 'bg-primary/20 text-primary',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Today" value={counts.today} icon={<Calendar className="h-4 w-4" />} color="text-blue-400" />
              <StatCard label="Overdue" value={counts.overdue} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-400" />
              <StatCard label="Upcoming" value={counts.upcoming} icon={<Clock className="h-4 w-4" />} color="text-amber-400" />
            </div>

            {/* Task list */}
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListTodo className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-foreground/70">No tasks here</p>
                <p className="text-sm text-muted-foreground">
                  {filterView === 'all' ? 'Create your first task' : `No ${filterView} tasks`}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggle(task)}
                    onDelete={() => handleDelete(task.id)}
                    onUpdate={(u) => updateTask(task.id, u).then(updateTaskInStore)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {pageView === 'calendar' && <TaskCalendar tasks={tasks} />}
      </div>

      <CreateTaskDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        userId={user?.id ?? ''}
        onCreated={(t) => addTask(t)}
      />
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-2 p-3 text-center">
      <div className={cn('flex justify-center mb-1', color)}>{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function TaskRow({
  task, onToggle, onDelete, onUpdate,
}: {
  task: Task
  onToggle: () => void
  onDelete: () => void
  onUpdate: (u: Partial<Task>) => void
}) {
  const isDone = task.status === 'done'
  const isOverdue = task.due_at && task.due_at < new Date().toISOString() && !isDone
  const priority = PRIORITY_CONFIG[task.priority]

  return (
    <div className={cn(
      'group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all',
      isDone ? 'border-border/30 bg-surface-2/40 opacity-60' : 'border-border/60 bg-surface-2',
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
          isDone ? 'border-primary bg-primary' : 'border-border/60 hover:border-primary/60',
        )}
      >
        {isDone && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
            <polyline points="1,6 5,10 11,2" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-snug', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.due_at && (
            <span className={cn('flex items-center gap-1 text-[11px]', isOverdue ? 'text-red-400' : 'text-muted-foreground')}>
              <Clock className="h-3 w-3" />
              {formatDate(task.due_at)}
              {isOverdue && ' · overdue'}
            </span>
          )}
          {task.priority !== 'none' && (
            <span className={cn('flex items-center gap-1 text-[11px]', priority.color)}>
              {priority.icon}
              {priority.label}
            </span>
          )}
          {task.recurrence !== 'none' && (
            <span className="text-[11px] text-muted-foreground">↻ {RECURRENCE_LABELS[task.recurrence]}</span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mt-0.5 flex-shrink-0 rounded-lg p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-3">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {(['none', 'low', 'medium', 'high'] as TaskPriority[]).map((p) => (
            <DropdownMenuItem key={p} onClick={() => onUpdate({ priority: p })}>
              {PRIORITY_CONFIG[p].icon}
              <span>Priority: {PRIORITY_CONFIG[p].label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function CreateTaskDialog({
  open, onClose, userId, onCreated,
}: {
  open: boolean
  onClose: () => void
  userId: string
  onCreated: (t: Task) => void
}) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('none')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return
    setLoading(true)
    const task = await createTask(userId, {
      title: title.trim(),
      due_at: dueAt || null,
      reminder_at: reminderAt || null,
      priority,
      recurrence,
    })
    onCreated(task)
    setTitle(''); setDueAt(''); setReminderAt(''); setPriority('none'); setRecurrence('none')
    onClose()
    setLoading(false)

    // Schedule notification if reminder set
    if (reminderAt && 'Notification' in window) {
      scheduleReminderNotification(task)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            label="Task title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Due date</label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Reminder</label>
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-border/60 bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {(['none', 'low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full rounded-xl border border-border/60 bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <Button className="w-full" onClick={handleCreate} loading={loading} disabled={!title.trim()}>
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function scheduleReminderNotification(task: Task) {
  if (!task.reminder_at) return
  scheduleReminder({
    id: `task-${task.id}`,
    title: 'Task Reminder',
    body: task.title,
    fire_at: task.reminder_at,
    url: '/tasks',
  }).catch(() => {
    // Fallback: in-memory for short reminders
    const ms = new Date(task.reminder_at!).getTime() - Date.now()
    if (ms > 0 && ms <= 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('Task Reminder', { body: task.title, icon: '/pwa-192x192.png' })
        }
      }, ms)
    }
  })
}

// ── Calendar View ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {}
    tasks.forEach((t) => {
      if (!t.due_at) return
      const d = t.due_at.slice(0, 10)
      const [ty, tm] = d.split('-').map(Number)
      if (ty === year && tm - 1 === month) {
        if (!map[d]) map[d] = []
        map[d].push(t)
      }
    })
    return map
  }, [tasks, year, month])

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full grid
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 transition-colors">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <p key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDay[dateStr] ?? []
          const isToday = dateStr === today.toISOString().slice(0, 10)
          const hasOverdue = dayTasks.some((t) => t.status === 'open' && dateStr < today.toISOString().slice(0, 10))

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[56px] rounded-lg p-1 border transition-colors',
                isToday ? 'border-primary/60 bg-primary/8' : 'border-transparent hover:border-border/60 hover:bg-surface-2',
              )}
            >
              <p className={cn(
                'text-xs font-medium text-right mb-0.5',
                isToday ? 'text-primary' : 'text-muted-foreground',
              )}>
                {day}
              </p>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <p
                    key={t.id}
                    className={cn(
                      'truncate rounded px-1 text-[10px] font-medium leading-tight py-0.5',
                      t.status === 'done'
                        ? 'bg-surface-3 text-muted-foreground line-through'
                        : hasOverdue
                          ? 'bg-red-950/40 text-red-300'
                          : 'bg-primary/15 text-primary',
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </p>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-[9px] text-muted-foreground text-right">+{dayTasks.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
