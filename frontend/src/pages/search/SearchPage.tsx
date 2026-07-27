import { useState, useMemo, useEffect } from 'react'
import { Search, X, SlidersHorizontal, Bookmark, BookmarkCheck, Trash2 } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useTasksStore } from '@/stores/tasksStore'
import { NoteCard } from '@/components/notes/NoteCard'
import { Button } from '@/components/ui/button'
import { cn, stripHtml } from '@/lib/utils'
import type { NoteType } from '@/types'
import { createSavedSearch, getSavedSearches, deleteSavedSearch } from '@/db/tasksdb'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

function parseSavedFilters(filters: string): { type_filter: NoteType | null; tag_filter: string | null } {
  try {
    const parsed = JSON.parse(filters)
    return {
      type_filter: parsed.type_filter ?? null,
      tag_filter: parsed.tag_filter ?? null,
    }
  } catch {
    return { type_filter: null, tag_filter: null }
  }
}

const FILTERS: Array<{ type: NoteType; label: string }> = [
  { type: 'rich', label: 'Rich' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'audio', label: 'Audio' },
  { type: 'photo', label: 'Photo' },
  { type: 'file', label: 'File' },
]

export default function SearchPage() {
  const { notes, tags } = useNotesStore()
  const { savedSearches, addSavedSearch, removeSavedSearch } = useTasksStore()
  const userId = useAuthStore((s) => s.user?.id ?? '')

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Load saved searches on mount
  useEffect(() => {
    if (!userId) return
    getSavedSearches(userId).then((searches) => {
      searches.forEach((s) => addSavedSearch(s))
    })
  }, [userId, addSavedSearch])

  const results = useMemo(() => {
    if (!query && !typeFilter && !tagFilter) return []
    return notes
      .filter((n) => !n.is_deleted)
      .filter((n) => {
        if (typeFilter && n.note_type !== typeFilter) return false
        if (tagFilter && !n.tags?.some((t) => t.id === tagFilter)) return false
        if (!query) return true
        const q = query.toLowerCase()
        return (
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.content).toLowerCase().includes(q) ||
          (n.attachments ?? []).some((att) =>
            (att.file_name ?? '').toLowerCase().includes(q) ||
            (att.search_text ?? '').toLowerCase().includes(q),
          )
        )
      })
  }, [query, typeFilter, tagFilter, notes])

  const hasActiveFilters = !!(query || typeFilter || tagFilter)

  const isSearchSaved = savedSearches.some(
    (s) => {
      const filters = parseSavedFilters(s.filters)
      return s.query === query && filters.type_filter === typeFilter && filters.tag_filter === tagFilter
    },
  )

  async function handleSaveSearch() {
    if (!hasActiveFilters || isSearchSaved) return
    const label = query || [typeFilter, tagFilter].filter(Boolean).join(', ') || 'Search'
    const search = await createSavedSearch(userId, label, query, {
      type_filter: typeFilter,
      tag_filter: tagFilter,
    })
    addSavedSearch(search)
    toast.success('Search saved')
  }

  async function handleDeleteSaved(id: string) {
    await deleteSavedSearch(id)
    removeSavedSearch(id)
    toast.success('Saved search removed')
  }

  function applySearch(query: string, typeFilter: NoteType | null, tagFilter: string | null) {
    setQuery(query)
    setTypeFilter(typeFilter)
    setTagFilter(tagFilter)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-screen-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                autoFocus
                className={cn(
                  'w-full rounded-xl border border-border/60 bg-surface-2 py-2.5 pl-9 pr-9 text-sm',
                  'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
                )}
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveSearch}
                disabled={isSearchSaved}
                title={isSearchSaved ? 'Already saved' : 'Save this search'}
              >
                {isSearchSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className={cn('h-4 w-4', (typeFilter || tagFilter) && 'text-primary')} />
            </Button>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Note Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        typeFilter === type ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tag</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          tagFilter === tag.id ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground',
                        )}
                      >
                        <div className="h-2 w-2 rounded-full" style={{ background: tag.color ?? '#6366f1' }} />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-5">
        {/* Saved searches */}
        {savedSearches.length > 0 && !hasActiveFilters && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved Searches</p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="group flex items-center gap-1 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5">
                  <button
                    onClick={() => {
                      const filters = parseSavedFilters(s.filters)
                      applySearch(s.query, filters.type_filter as NoteType | null, filters.tag_filter)
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                  >
                    <Bookmark className="h-3 w-3 text-primary" />
                    {s.name}
                  </button>
                  <button
                    onClick={() => handleDeleteSaved(s.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Search your encrypted notes</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <X className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-foreground/80">No results</p>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {results.map((note) => (
                <NoteCard key={note.id} note={note} view="list" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
