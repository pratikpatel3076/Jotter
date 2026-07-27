import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, MapPin, Plus, Users } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function CalendarPage() {
  const navigate = useNavigate()
  const { createNote } = useNotes()
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState('')
  const [saving, setSaving] = useState(false)

  async function createMeetingNote() {
    if (!title.trim() || !startsAt) return
    setSaving(true)
    const html = [
      `<h2>${escapeHtml(title.trim())}</h2>`,
      `<p><strong>When:</strong> ${escapeHtml(new Date(startsAt).toLocaleString())}${endsAt ? ` - ${escapeHtml(new Date(endsAt).toLocaleString())}` : ''}</p>`,
      location ? `<p><strong>Where:</strong> ${escapeHtml(location)}</p>` : '',
      attendees ? `<p><strong>Attendees:</strong> ${escapeHtml(attendees)}</p>` : '',
      '<h3>Agenda</h3><ul><li></li></ul>',
      '<h3>Notes</h3><p></p>',
      '<h3>Action Items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>',
    ].filter(Boolean).join('\n')
    const note = await createNote({
      title: title.trim(),
      content: html,
      note_type: 'meeting',
      source_url: `calendar:manual:${Date.now()}`,
      due_at: new Date(startsAt).toISOString(),
    })
    navigate(`/notes/${note.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-screen-sm">
          <h1 className="text-lg font-extrabold">Calendar</h1>
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm space-y-4 px-4 py-4">
        <section className="rounded-xl border border-border/60 bg-surface-1 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Create Meeting Note</h2>
              <p className="text-sm text-muted-foreground">Link notes to manual calendar events.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly planning" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateField label="Starts" icon={<Clock className="h-4 w-4" />} value={startsAt} onChange={setStartsAt} />
              <DateField label="Ends" icon={<Clock className="h-4 w-4" />} value={endsAt} onChange={setEndsAt} />
            </div>
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} leftIcon={<MapPin className="h-4 w-4" />} />
            <Input label="Attendees" value={attendees} onChange={(e) => setAttendees(e.target.value)} leftIcon={<Users className="h-4 w-4" />} placeholder="name@example.com, team" />
            <Button className="w-full" onClick={createMeetingNote} loading={saving} disabled={!title.trim() || !startsAt}>
              <Plus className="h-4 w-4" />
              Create linked meeting note
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

function DateField({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground/80">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-surface-2 py-2.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
    </div>
  )
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
