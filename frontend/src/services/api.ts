import axios, { type AxiosInstance, type AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token refresh ──────────────────────────────────────────────────────────────

let refreshing = false
let refreshQueue: Array<() => void> = []

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (refreshing) {
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(api(original)))
        })
      }
      refreshing = true
      try {
        await axios.post(`${BASE_URL}/v1/auth/refresh`, {}, { withCredentials: true })
        refreshQueue.forEach((cb) => cb())
        refreshQueue = []
        return api(original)
      } catch {
        window.dispatchEvent(new Event('auth:logout'))
        return Promise.reject(error)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const authApi = {
  signup: (data: { full_name: string; email: string; password: string; encrypted_master_key: string; kdf_salt: string; recovery_bundle: string }) =>
    api.post('/v1/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post('/v1/auth/login', data),

  google: (data: { id_token: string; encrypted_master_key?: string; kdf_salt?: string; recovery_bundle?: string }) =>
    api.post('/v1/auth/google', data),

  refresh: () => api.post('/v1/auth/refresh'),

  forgotPassword: (email: string) =>
    api.post('/v1/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; new_password: string; recovery_key?: string }) =>
    api.post('/v1/auth/reset-password', data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/v1/auth/change-password', data),

  logout: () => api.post('/v1/auth/logout'),

  me: () => api.get('/v1/auth/me'),

  getEncryptedMasterKey: () => api.get('/v1/auth/master-key'),

  updateEncryptedMasterKey: (data: { encrypted_master_key: string; kdf_salt: string }) =>
    api.put('/v1/auth/master-key', data),

  getSessions: () => api.get('/v1/auth/sessions'),

  revokeSession: (session_id: string) => api.delete(`/v1/auth/sessions/${session_id}`),

  connectGoogleDrive: (data: { access_token: string; expires_in?: number; scope: string }) =>
    api.post('/v1/auth/google-drive/connect', data),
}

// ── Sync endpoints ────────────────────────────────────────────────────────────

export const syncApi = {
  push: (payload: unknown) => api.post('/v1/sync/push', payload),
  pull: (last_sync_token?: string) => api.get('/v1/sync/pull', { params: { last_sync_token } }),
  resolveConflict: (data: { entity_type: string; entity_id: string; resolution: string; payload?: unknown }) =>
    api.post('/v1/sync/conflict', data),
}

export const sharingApi = {
  listNoteShares: (noteId: string) => api.get(`/v1/sharing/notes/${noteId}`),
  shareNote: (data: { note_id: string; recipient_email: string; permission: 'view' | 'edit' }) =>
    api.post('/v1/sharing/notes', data),
  revokeShare: (shareId: string) => api.delete(`/v1/sharing/${shareId}`),
}
