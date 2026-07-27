export type TaskPriority = 'none' | 'low' | 'medium' | 'high'
export type TaskStatus = 'open' | 'done' | 'cancelled'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Task {
  id: string
  note_id: string | null
  user_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  reminder_at: string | null
  recurrence: RecurrenceType
  recurrence_end: string | null
  completed_at: string | null
  tags: string[]
  created_at: string
  updated_at: string
  sync_status: string
}

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  query: string
  filters: string // JSON-serialized SearchFilters
  created_at: string
}

export interface NoteVersion {
  id: string
  note_id: string
  title: string
  content: string
  created_at: string
  word_count: number
}
