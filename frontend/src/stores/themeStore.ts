import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'system'
export type AccentColor = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose'

export const ACCENT_COLORS: Record<AccentColor, string> = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
}

interface ThemeStore {
  theme: Theme
  accent: AccentColor
  setTheme: (t: Theme) => void
  setAccent: (accent: AccentColor) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      accent: 'indigo',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      setAccent: (accent) => {
        set({ accent })
        applyAccent(accent)
      },
    }),
    { name: 'jotter-theme' },
  ),
)

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function applyAccent(accent: AccentColor) {
  document.documentElement.style.setProperty('--color-primary', ACCENT_COLORS[accent])
}

export function initTheme() {
  const stored = localStorage.getItem('jotter-theme')
  let theme: Theme = 'dark'
  if (stored) {
    try { theme = JSON.parse(stored).state?.theme ?? 'dark' } catch { /* */ }
  }
  applyTheme(theme)
  if (stored) {
    try { applyAccent(JSON.parse(stored).state?.accent ?? 'indigo') } catch { applyAccent('indigo') }
  } else {
    applyAccent('indigo')
  }

  // Watch system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system')
  })
}
