import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, useEffect, type ReactNode } from 'react'

import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import { clearSessionKey, isVaultOpen } from '@/db/vault'
import { initNotifications } from '@/lib/notifications'
import { initTheme } from '@/stores/themeStore'

// Apply persisted theme before first render
initTheme()

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'

// App pages
import DashboardPage from '@/pages/DashboardPage'
import NoteEditorPage from '@/pages/notes/NoteEditorPage'
import NotebooksPage from '@/pages/notebooks/NotebooksPage'
import TagsPage from '@/pages/tags/TagsPage'
import SearchPage from '@/pages/search/SearchPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import TasksPage from '@/pages/tasks/TasksPage'
import ClipPage from '@/pages/clip/ClipPage'
import CalendarPage from '@/pages/calendar/CalendarPage'
import SyncCenterPage from '@/pages/sync/SyncCenterPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (error.message.includes('Vault is locked')) {
      window.dispatchEvent(new Event('auth:logout'))
      window.location.replace('/login')
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Jotter could not open this page</p>
          <h1 className="mt-2 text-2xl font-semibold">Dashboard error</h1>
          <p className="mt-3 rounded-md bg-muted p-3 font-mono text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          <button
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, clearAuth } = useAuthStore()
  const vaultOpen = isVaultOpen()

  if (!isAuthenticated || !vaultOpen) {
    if (isAuthenticated && !vaultOpen) {
      clearSessionKey()
      clearAuth()
    }
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    function handleForceLogout() {
      clearSessionKey()
      useAuthStore.getState().clearAuth()
    }
    window.addEventListener('auth:logout', handleForceLogout)

    // Init notifications (request permission + register SW)
    if (useAuthStore.getState().isAuthenticated) {
      initNotifications().catch(() => {})
    }

    return () => window.removeEventListener('auth:logout', handleForceLogout)
  }, [])

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/notes/:id" element={<NoteEditorPage />} />
              <Route path="/notebooks" element={<NotebooksPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/clip" element={<ClipPage />} />
              <Route path="/sync" element={<SyncCenterPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
