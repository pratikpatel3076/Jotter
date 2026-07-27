import { useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sharingApi } from '@/services/api'
import { toast } from 'sonner'

interface Share {
  id: string
  recipient_email: string
  permission: 'view' | 'edit'
}

export function ShareNoteDialog({ noteId, open, onClose }: { noteId: string; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    const resp = await sharingApi.listNoteShares(noteId)
    setShares(resp.data)
  }

  useEffect(() => {
    if (open) refresh().catch(() => {})
  }, [open, noteId])

  async function share() {
    if (!email.trim()) return
    setLoading(true)
    try {
      await sharingApi.shareNote({ note_id: noteId, recipient_email: email.trim(), permission })
      setEmail('')
      await refresh()
      toast.success('Note shared')
    } catch {
      toast.error('Failed to share note')
    } finally {
      setLoading(false)
    }
  }

  async function revoke(id: string) {
    await sharingApi.revokeShare(id)
    await refresh()
    toast.success('Access revoked')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Access</label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                className="h-[42px] rounded-xl border border-border/60 bg-surface-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
            </div>
          </div>
          <Button className="w-full" onClick={share} loading={loading} disabled={!email.trim()}>
            <UserPlus className="h-4 w-4" />
            Share
          </Button>

          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{share.recipient_email}</p>
                  <p className="text-xs capitalize text-muted-foreground">{share.permission}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => revoke(share.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {shares.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/60 px-3 py-5 text-center text-sm text-muted-foreground">
                No one else has access yet.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
