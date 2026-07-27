export type NoteType =
  | 'text'
  | 'rich'
  | 'checklist'
  | 'task'
  | 'audio'
  | 'photo'
  | 'file'
  | 'pdf'
  | 'drawing'
  | 'webclip'
  | 'meeting'
  | 'scan'

export type SyncStatus =
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'synced'
  | 'conflict'
  | 'error'

export type UploadStatus = 'pending_upload' | 'uploading' | 'uploaded' | 'error'

export interface LocalUser {
  id: string
  email: string
  full_name: string | null
  encrypted_master_key: string | null
  kdf_salt: string | null
  kdf_algorithm: string
  kdf_iterations: number
  last_login_at: string | null
  is_active: number
}

export interface LocalNote {
  id: string
  server_id: string | null
  user_id: string
  notebook_id: string | null
  note_type: NoteType
  encrypted_title: string | null
  encrypted_payload: string
  encrypted_note_key: string | null
  encryption_version: number
  encryption_algorithm: string
  iv: string
  content_hash: string | null
  color: string | null
  icon: string | null
  source_url: string | null
  category_names?: string[]
  group_id?: string | null
  sort_order?: number
  reminder_at: string | null
  due_at: string | null
  is_pinned: number
  is_favorite: number
  is_archived: number
  is_deleted: number
  sync_status: SyncStatus
  sync_version: number
  local_updated_at: string
  server_updated_at: string | null
  created_at: string
  deleted_at: string | null
}

export interface LocalNotebook {
  id: string
  server_id: string | null
  user_id: string
  parent_id: string | null
  encrypted_title: string
  encrypted_description: string | null
  color: string | null
  icon: string | null
  cover_file_id: string | null
  category_names?: string[]
  sort_order: number
  is_pinned: number
  is_archived: number
  is_deleted: number
  sync_status: SyncStatus
  sync_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface LocalTag {
  id: string
  server_id: string | null
  user_id: string
  encrypted_name: string
  color: string | null
  usage_count: number
  is_deleted: number
  sync_status: SyncStatus
  sync_version: number
  created_at: string
  updated_at: string
}

export interface LocalNoteTag {
  note_id: string
  tag_id: string
  sync_status: SyncStatus
  created_at: string
}

export interface LocalAttachment {
  id: string
  server_id: string | null
  note_id: string | null
  user_id: string
  encrypted_file_name: string | null
  encrypted_data?: string | null
  encrypted_search_text?: string | null
  mime_type: string | null
  file_size: number | null
  local_file_path: string | null
  encrypted_file_key: string | null
  encryption_algorithm: string
  iv: string | null
  content_hash: string | null
  storage_provider: string
  upload_status: UploadStatus
  sync_status: SyncStatus
  sync_version: number
  created_at: string
  updated_at: string
}

export interface SyncQueueItem {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  operation: 'create' | 'update' | 'delete'
  payload: string | null
  attempt_count: number
  last_error: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  created_at: string
  updated_at: string
}

// Decrypted/display models
export interface Note {
  id: string
  server_id: string | null
  notebook_id: string | null
  note_type: NoteType
  title: string
  content: string
  color: string | null
  icon: string | null
  source_url: string | null
  category_names: string[]
  group_id: string | null
  sort_order: number
  reminder_at: string | null
  due_at: string | null
  is_pinned: boolean
  is_favorite: boolean
  is_archived: boolean
  is_deleted: boolean
  sync_status: SyncStatus
  created_at: string
  updated_at: string
  tags?: Tag[]
  attachments?: Attachment[]
  word_count?: number
  char_count?: number
}

export interface Notebook {
  id: string
  server_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  color: string | null
  icon: string | null
  cover_file_id: string | null
  category_names: string[]
  sort_order: number
  is_pinned: boolean
  is_archived: boolean
  is_deleted: boolean
  sync_status: SyncStatus
  created_at: string
  updated_at: string
  note_count?: number
}

export interface Tag {
  id: string
  server_id: string | null
  name: string
  color: string | null
  usage_count: number
  is_deleted: boolean
  sync_status: SyncStatus
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  note_id: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  object_url?: string | null
  search_text?: string | null
  local_file_path: string | null
  upload_status: UploadStatus
  created_at: string
}

// Auth types
export interface AuthUser {
  id: string
  email: string
  full_name: string | null
}

export interface LoginRequest {
  email: string
  password: string
  remember_me?: boolean
}

export interface SignupRequest {
  full_name: string
  email: string
  password: string
  confirm_password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface AuthResponse {
  user: AuthUser
  tokens: AuthTokens
  encrypted_master_key: string
  recovery_key?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; scope?: string }) => void
          prompt: () => void
        }
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; scope?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

// Checklist item
export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  order: number
}

// Note content variants
export interface RichTextContent {
  type: 'rich'
  html: string
  text: string
}

export interface ChecklistContent {
  type: 'checklist'
  items: ChecklistItem[]
}

export interface AudioContent {
  type: 'audio'
  attachment_id: string
  duration?: number
  transcript?: string
}

export interface PhotoContent {
  type: 'photo'
  attachment_ids: string[]
  caption?: string
}

export interface FileContent {
  type: 'file'
  attachment_id: string
  description?: string
}

export type NoteContent = RichTextContent | ChecklistContent | AudioContent | PhotoContent | FileContent | { type: 'text'; text: string }

// Search / filter
export interface SearchFilters {
  query: string
  note_type?: NoteType
  notebook_id?: string
  tag_id?: string
  category?: string
  is_pinned?: boolean
  is_favorite?: boolean
  is_archived?: boolean
  has_attachment?: boolean
  date_from?: string
  date_to?: string
}

// Sync
export interface SyncPayload {
  notes?: LocalNote[]
  notebooks?: LocalNotebook[]
  tags?: LocalTag[]
  note_tags?: LocalNoteTag[]
  attachments?: LocalAttachment[]
  last_sync_token?: string
}

export interface SyncResponse {
  notes?: LocalNote[]
  notebooks?: LocalNotebook[]
  tags?: LocalTag[]
  note_tags?: LocalNoteTag[]
  sync_token: string
  conflicts?: ConflictItem[]
}

export interface ConflictItem {
  entity_type: string
  entity_id: string
  local_version: unknown
  server_version: unknown
}
