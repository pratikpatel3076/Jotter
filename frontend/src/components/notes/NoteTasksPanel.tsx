import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { createTask, deleteTask, getTasksByNote, updateTask } from '@/db/tasksdb'
import type { Task } from '@/types/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  noteId: string | null
}

export function NoteTasksPanel({ noteId }: Props) {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')

  async function refresh() {
    if (!noteId) return
    setTasks(await getTasksByNote(noteId))
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [noteId])

  async function addTask() {
    if (!noteId || !userId || !title.trim()) return
    await createTask(userId, { note_id: noteId, title: title.trim() })
    setTitle('')
    await refresh()
  }

  async function toggle(task: Task) {
    await updateTask(task.id, { status: task.status === 'done' ? 'open' : 'done' })
    await refresh()
  }

  async function remove(id: string) {
    await deleteTask(id)
    await refresh()
  }

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-surface-2 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tasks in this note</h2>
        <span className="text-xs text-muted-foreground">{tasks.filter((t) => t.status !== 'done').length} open</span>
      </div>

      <div className="mb-3 flex gap-2">
        <Input
          placeholder={noteId ? 'Add a task' : 'Save the note before adding tasks'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          disabled={!noteId}
        />
        <Button size="icon" onClick={addTask} disabled={!noteId || !title.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-5 text-center text-sm text-muted-foreground">
          Add action items without leaving the note.
        </p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-1 px-3 py-2">
              <button onClick={() => toggle(task)} className="text-primary">
                {task.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </button>
              <span className={cn('min-w-0 flex-1 truncate text-sm transition-all', task.status === 'done' && 'text-muted-foreground line-through opacity-60')}>
                {task.title}
              </span>
              <button onClick={() => remove(task.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
