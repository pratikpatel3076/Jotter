import axios, { type AxiosInstance, type AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Attach JWT ────────────────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Token refresh ──────────────────────────────────────────────────────────────

let refreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (refreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers!.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }
      refreshing = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const resp = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
        const { access_token, refresh_token: newRefresh } = resp.data
        localStorage.setItem('access_token', access_token)
        if (newRefresh) localStorage.setItem('refresh_token', newRefresh)
        refreshQueue.forEach((cb) => cb(access_token))
        refreshQueue = []
        original.headers!.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
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
    api.post('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  google: (data: { id_token: string; encrypted_master_key?: string; kdf_salt?: string; recovery_bundle?: string }) =>
    api.post('/auth/google', data),

  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; new_password: string; recovery_key?: string }) =>
    api.post('/auth/reset-password', data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  getEncryptedMasterKey: () => api.get('/auth/master-key'),

  updateEncryptedMasterKey: (data: { encrypted_master_key: string; kdf_salt: string }) =>
    api.put('/auth/master-key', data),

  getSessions: () => api.get('/auth/sessions'),

  revokeSession: (session_id: string) => api.delete(`/auth/sessions/${session_id}`),

  connectGoogleDrive: (data: { access_token: string; expires_in?: number; scope: string }) =>
    api.post('/auth/google-drive/connect', data),
}

// ── Sync endpoints ────────────────────────────────────────────────────────────

export const syncApi = {
  push: (payload: unknown) => api.post('/sync/push', payload),
  pull: (last_sync_token?: string) => api.get('/sync/pull', { params: { last_sync_token } }),
  resolveConflict: (data: { entity_type: string; entity_id: string; resolution: string; payload?: unknown }) =>
    api.post('/sync/conflict', data),
}

export const sharingApi = {
  listNoteShares: (noteId: string) => api.get(`/v1/sharing/notes/${noteId}`),
  shareNote: (data: { note_id: string; recipient_email: string; permission: 'view' | 'edit' }) =>
    api.post('/v1/sharing/notes', data),
  revokeShare: (shareId: string) => api.delete(`/v1/sharing/${shareId}`),
}
