import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Lock, LogOut, RefreshCw, Smartphone, Shield,
  ChevronRight, Eye, EyeOff, Key, Cloud, FileJson,
  Sun, Moon, Monitor, Upload, Globe, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotes } from '@/hooks/useNotes'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useSyncStore } from '@/stores/syncStore'
import { ACCENT_COLORS, useThemeStore, type AccentColor, type Theme } from '@/stores/themeStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authApi } from '@/services/api'
import { toast } from 'sonner'
import { exportAsJSON } from '@/lib/exportNote'
import { importFromJSON, importFromMarkdown } from '@/lib/importNote'
import { useNotes as useNotesHook } from '@/hooks/useNotes'
import { requestDriveAppDataToken } from '@/lib/googleIdentity'
import { uploadEncryptedBackupToAppData } from '@/lib/googleDriveBackup'
import { getEncryptedBackupPayload } from '@/db/vault'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const { syncNow } = useNotes()
  const { state: syncState, lastSync, lastAttempt, pendingCount, failedCount, conflicts, lastError, clearConflicts } = useSyncStore()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const { notes } = useNotesStore()
  const { theme, accent, setTheme, setAccent } = useThemeStore()
  const { createNote } = useNotesHook()
  const importRef = useRef<HTMLInputElement>(null)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-screen-sm">
          <h1 className="text-lg font-extrabold">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
        {/* Profile */}
        <section className="rounded-2xl border border-border/60 bg-surface-1 overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-lg font-bold text-primary">
              {user ? getInitials(user.full_name ?? user.email) : 'J'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user?.full_name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Sync */}
        <section className="rounded-2xl border border-border/60 bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground">Sync</h2>
          </div>
          <div className="divide-y divide-border/40">
            <SettingsRow
              icon={<RefreshCw className={cn('h-4 w-4', syncState === 'syncing' && 'animate-spin')} />}
              label="Sync Now"
              description={lastSync ? `Last synced ${formatDate(lastSync)}` : 'Never synced'}
              badge={pendingCount > 0 ? `${pendingCount} pending` : failedCount > 0 ? `${failedCount} failed` : undefined}
              onClick={() => syncNow()}
            />
            <SyncHealthCard
              state={syncState}
              lastSync={lastSync}
              lastAttempt={lastAttempt}
              pendingCount={pendingCount}
              failedCount={failedCount}
              conflictCount={conflicts.length}
              lastError={lastError}
              onSync={() => syncNow()}
              onClearConflicts={clearConflicts}
            />
            <SettingsRow
              icon={<Smartphone className="h-4 w-4" />}
              label="Device Sessions"
              description="Manage active devices"
              onClick={() => navigate('/settings/sessions')}
            />
          </div>
        </section>

        {/* Security */}
        <section className="rounded-2xl border border-border/60 bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
          </div>
          <div className="divide-y divide-border/40">
            <SettingsRow
              icon={<Lock className="h-4 w-4" />}
              label="Change Password"
              description="Update your vault password"
              onClick={() => setShowChangePassword(true)}
            />
            <SettingsRow
              icon={<Key className="h-4 w-4" />}
              label="Recovery Key"
              description="View or regenerate recovery key"
              onClick={() => toast.info('Recovery key management coming soon')}
            />
            <SettingsRow
              icon={<Shield className="h-4 w-4" />}
              label="Encryption Info"
              description="AES-256-GCM end-to-end encryption"
            />
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-2xl border border-border/60 bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">Theme</p>
            <div className="flex gap-2">
              {([
                { value: 'light' as Theme, icon: Sun, label: 'Light' },
                { value: 'dark' as Theme, icon: Moon, label: 'Dark' },
                { value: 'system' as Theme, icon: Monitor, label: 'System' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-all',
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-4 text-xs text-muted-foreground">Accent color</p>
            <div className="grid grid-cols-5 gap-2">
              {([
                ['indigo', 'Indigo'],
                ['violet', 'Violet'],
                ['emerald', 'Emerald'],
                ['amber', 'Amber'],
                ['rose', 'Rose'],
              ] as Array<[AccentColor, string]>).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setAccent(value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-all',
                    accent === value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: ACCENT_COLORS[value] }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Storage */}
        <section className="rounded-2xl border border-border/60 bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground">Data</h2>
          </div>
          <div className="divide-y divide-border/40">
            <SettingsRow
              icon={<Cloud className="h-4 w-4" />}
              label="Connect Google Drive for Secure Backup & Sync"
              description="Uses only the private Google Drive appDataFolder"
              onClick={async () => {
                try {
                  const token = await requestDriveAppDataToken()
                  await authApi.connectGoogleDrive(token)
                  await uploadEncryptedBackupToAppData(token.access_token, await getEncryptedBackupPayload())
                  toast.success('Google Drive secure backup connected')
                } catch (e: unknown) {
                  toast.error((e as Error).message || 'Google Drive connection failed')
                }
              }}
            />
            <SettingsRow
              icon={<FileJson className="h-4 w-4" />}
              label="Export All Notes"
              description={`Download ${notes.filter((n) => !n.is_deleted).length} notes as JSON`}
              onClick={() => {
                const active = notes.filter((n) => !n.is_deleted)
                if (!active.length) { toast.error('No notes to export'); return }
                exportAsJSON(active)
                toast.success('Export started')
              }}
            />
            <SettingsRow
              icon={<Upload className="h-4 w-4" />}
              label="Import Notes"
              description="Import from JSON or Markdown files"
              onClick={() => importRef.current?.click()}
            />
            <SettingsRow
              icon={<Globe className="h-4 w-4" />}
              label="Copy Web Clipper Bookmarklet"
              description="Clip the current page into Jotter"
              onClick={async () => {
                const origin = window.location.origin
                const bookmarklet = `javascript:(()=>{const s=window.getSelection().toString();const q=new URLSearchParams({title:document.title,url:location.href,text:s||document.querySelector('meta[name="description"]')?.content||''});open('${origin}/clip?'+q.toString(),'_blank')})()`
                await navigator.clipboard.writeText(bookmarklet)
                toast.success('Bookmarklet copied')
              }}
            />
          </div>
        </section>

        {/* Hidden import file input */}
        <input
          ref={importRef}
          type="file"
          multiple
          accept=".json,.md,.markdown"
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            if (!files.length) return
            let imported = 0
            for (const file of files) {
              try {
                const text = await file.text()
                if (file.name.endsWith('.json')) {
                  const notes = await importFromJSON(text)
                  for (const n of notes) await createNote(n)
                  imported += notes.length
                } else {
                  const note = importFromMarkdown(file.name, text)
                  await createNote(note)
                  imported++
                }
              } catch { toast.error(`Failed to import ${file.name}`) }
            }
            if (imported) toast.success(`Imported ${imported} note${imported > 1 ? 's' : ''}`)
            e.target.value = ''
          }}
        />

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-800/30 bg-red-950/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-800/30">
            <h2 className="text-sm font-semibold text-red-400">Account</h2>
          </div>
          <div className="divide-y divide-red-800/20">
            <SettingsRow
              icon={<LogOut className="h-4 w-4 text-red-400" />}
              label={<span className="text-red-400">Sign Out</span>}
              onClick={logout}
            />
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          Jotter v1.0.0 — End-to-end encrypted
        </p>
      </div>

      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  )
}

function SettingsRow({
  icon, label, description, badge, onClick,
}: {
  icon?: React.ReactNode
  label: React.ReactNode
  description?: string
  badge?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        onClick ? 'hover:bg-surface-2 active:bg-surface-3 cursor-pointer' : 'cursor-default',
      )}
    >
      {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {badge && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
          {badge}
        </span>
      )}
      {onClick && <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />}
    </button>
  )
}

function SyncHealthCard({
  state,
  lastSync,
  lastAttempt,
  pendingCount,
  failedCount,
  conflictCount,
  lastError,
  onSync,
  onClearConflicts,
}: {
  state: string
  lastSync: string | null
  lastAttempt: string | null
  pendingCount: number
  failedCount: number
  conflictCount: number
  lastError: string | null
  onSync: () => void
  onClearConflicts: () => void
}) {
  const healthy = state !== 'error' && pendingCount === 0 && failedCount === 0 && conflictCount === 0
  return (
    <div className="px-4 py-3">
      <div className={cn(
        'rounded-xl border p-3',
        healthy ? 'border-green-800/30 bg-green-950/10' : 'border-amber-800/40 bg-amber-950/10',
      )}>
        <div className="flex items-start gap-3">
          {healthy ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{healthy ? 'Sync healthy' : 'Sync needs attention'}</p>
            <p className="text-xs text-muted-foreground">
              {lastSync ? `Last success ${formatDate(lastSync)}` : 'No successful sync yet'}
              {lastAttempt ? ` · Last attempt ${formatDate(lastAttempt)}` : ''}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="font-semibold">{pendingCount}</p>
                <p className="text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="font-semibold">{failedCount}</p>
                <p className="text-muted-foreground">Failed</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-2 py-1.5">
                <p className="font-semibold">{conflictCount}</p>
                <p className="text-muted-foreground">Conflicts</p>
              </div>
            </div>
            {lastError && <p className="mt-2 text-xs text-red-400">{lastError}</p>}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={onSync}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry Sync
              </Button>
              {conflictCount > 0 && (
                <Button size="sm" variant="ghost" onClick={onClearConflicts}>
                  Clear Conflicts
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (newPass !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await authApi.changePassword({ current_password: current, new_password: newPass })
      toast.success('Password changed')
      onClose()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {error && (
            <div className="rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">{error}</div>
          )}
          <Input
            label="Current Password"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            rightIcon={<button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
          />
          <Input label="New Password" type={show ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          <Input label="Confirm New Password" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirm && confirm !== newPass ? 'Passwords do not match' : undefined} />
          <Button className="w-full" onClick={handleSubmit} loading={loading}>Update Password</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

