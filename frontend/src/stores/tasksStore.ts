import { create } from 'zustand'
import type { Task, SavedSearch } from '@/types/tasks'

interface TasksState {
  tasks: Task[]
  savedSearches: SavedSearch[]
  setTasks: (tasks: Task[]) => void
  setSavedSearches: (ss: SavedSearch[]) => void
  addTask: (t: Task) => void
  updateTaskInStore: (t: Task) => void
  removeTask: (id: string) => void
  addSavedSearch: (s: SavedSearch) => void
  removeSavedSearch: (id: string) => void
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  savedSearches: [],
  setTasks: (tasks) => set({ tasks }),
  setSavedSearches: (savedSearches) => set({ savedSearches }),
  addTask: (t) => set((s) => ({ tasks: [t, ...s.tasks] })),
  updateTaskInStore: (t) => set((s) => ({ tasks: s.tasks.map((x) => (x.id === t.id ? t : x)) })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) })),
  addSavedSearch: (ss) => set((s) => ({ savedSearches: [...s.savedSearches, ss] })),
  removeSavedSearch: (id) => set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
}))
