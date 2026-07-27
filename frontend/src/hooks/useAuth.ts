import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { authApi } from '@/services/api'
import { generateMasterKey, wrapMasterKey, unwrapMasterKey, generateRecoveryKey } from '@/crypto/encryption'
import { setSessionKey, clearSessionKey, getAllNotes, getAllNotebooks, getAllTags } from '@/db/vault'
import { saveUser, getUserByEmail } from '@/db/indexeddb'
import type { SignupRequest, LoginRequest } from '@/types'
import { requestGoogleIdToken } from '@/lib/googleIdentity'

export function useAuth() {
  const navigate = useNavigate()
  const { setUser, clearAuth } = useAuthStore()
  const { setNotes, setNotebooks, setTags, setLoading } = useNotesStore()
  const [loading, setLocalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signup(data: SignupRequest): Promise<{ recovery_key: string } | null> {
    setLocalLoading(true)
    setError(null)
    try {
      // 1. Generate master key
      const masterKey = await generateMasterKey()
      // 2. Wrap with password
      const wrapped = await wrapMasterKey(masterKey, data.password)
      // 3. Generate recovery key
      const { recovery_key, encrypted_with_recovery } = await generateRecoveryKey(masterKey)

      // 4. Register on server
      const resp = await authApi.signup({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        encrypted_master_key: JSON.stringify(wrapped),
        kdf_salt: wrapped.salt,
        recovery_bundle: JSON.stringify(encrypted_with_recovery),
      })

      const { user, tokens } = resp.data
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)

      // 5. Save user locally
      await saveUser({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        encrypted_master_key: JSON.stringify(wrapped),
        kdf_salt: wrapped.salt,
        kdf_algorithm: 'PBKDF2',
        kdf_iterations: wrapped.kdf_iterations,
        last_login_at: new Date().toISOString(),
        is_active: 1,
      })

      // 6. Open vault
      setSessionKey(masterKey, user.id)
      setUser(user)
      navigate('/dashboard')
      return { recovery_key }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Signup failed'
      setError(msg)
      return null
    } finally {
      setLocalLoading(false)
    }
  }

  async function login(data: LoginRequest): Promise<void> {
    setLocalLoading(true)
    setError(null)
    try {
      const resp = await authApi.login({ email: data.email, password: data.password })
      const { user, tokens, encrypted_master_key } = resp.data
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)

      // Unwrap master key
      const wrapped = JSON.parse(encrypted_master_key)
      const masterKey = await unwrapMasterKey(wrapped, data.password)

      // Update local user
      await saveUser({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        encrypted_master_key,
        kdf_salt: wrapped.salt,
        kdf_algorithm: 'PBKDF2',
        kdf_iterations: wrapped.kdf_iterations,
        last_login_at: new Date().toISOString(),
        is_active: 1,
      })

      setSessionKey(masterKey, user.id)
      setUser(user)

      // Load notes
      setLoading(true)
      const [notes, notebooks, tags] = await Promise.all([
        getAllNotes(),
        getAllNotebooks(),
        getAllTags(),
      ])
      setNotes(notes)
      setNotebooks(notebooks)
      setTags(tags)
      setLoading(false)

      navigate('/dashboard')
    } catch (e: unknown) {
      const axErr = e as { response?: { data?: { detail?: string } } }
      // Try offline login
      if (!axErr?.response) {
        await offlineLogin(data.email, data.password)
        return
      }
      setError(axErr?.response?.data?.detail ?? 'Login failed')
    } finally {
      setLocalLoading(false)
    }
  }

  async function googleLogin(): Promise<{ recovery_key?: string } | null> {
    setLocalLoading(true)
    setError(null)
    try {
      const idToken = await requestGoogleIdToken()
      const deviceSecretKey = 'google_vault_secret'
      let deviceSecret = localStorage.getItem(deviceSecretKey)
      let recoveryKey: string | undefined
      let payload: { id_token: string; encrypted_master_key?: string; kdf_salt?: string; recovery_bundle?: string } = { id_token: idToken }

      if (!deviceSecret) {
        deviceSecret = crypto.randomUUID() + crypto.randomUUID()
        const masterKey = await generateMasterKey()
        const wrapped = await wrapMasterKey(masterKey, deviceSecret)
        const recovery = await generateRecoveryKey(masterKey)
        payload = {
          id_token: idToken,
          encrypted_master_key: JSON.stringify(wrapped),
          kdf_salt: wrapped.salt,
          recovery_bundle: JSON.stringify(recovery.encrypted_with_recovery),
        }
        recoveryKey = recovery.recovery_key
      }

      const resp = await authApi.google(payload)
      const { user, tokens, encrypted_master_key } = resp.data
      if (!encrypted_master_key) throw new Error('No encrypted vault returned')
      const wrapped = JSON.parse(encrypted_master_key)
      const masterKey = await unwrapMasterKey(wrapped, deviceSecret)
      localStorage.setItem(deviceSecretKey, deviceSecret)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      await saveUser({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        encrypted_master_key,
        kdf_salt: wrapped.salt,
        kdf_algorithm: 'PBKDF2',
        kdf_iterations: wrapped.kdf_iterations,
        last_login_at: new Date().toISOString(),
        is_active: 1,
      })
      setSessionKey(masterKey, user.id)
      setUser(user)
      const [notes, notebooks, tags] = await Promise.all([getAllNotes(), getAllNotebooks(), getAllTags()])
      setNotes(notes); setNotebooks(notebooks); setTags(tags)
      navigate('/dashboard')
      return recoveryKey ? { recovery_key: recoveryKey } : {}
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? err.message ?? 'Google sign-in failed')
      return null
    } finally {
      setLocalLoading(false)
    }
  }

  async function offlineLogin(email: string, password: string): Promise<void> {
    const localUser = await getUserByEmail(email)
    if (!localUser || !localUser.encrypted_master_key) {
      setError('No offline data found. Please connect to the internet for first login.')
      return
    }
    const wrapped = JSON.parse(localUser.encrypted_master_key)
    const masterKey = await unwrapMasterKey(wrapped, password).catch(() => {
      throw new Error('Incorrect password')
    })
    setSessionKey(masterKey, localUser.id)
    setUser({ id: localUser.id, email: localUser.email, full_name: localUser.full_name })

    setLoading(true)
    const [notes, notebooks, tags] = await Promise.all([
      getAllNotes(),
      getAllNotebooks(),
      getAllTags(),
    ])
    setNotes(notes)
    setNotebooks(notebooks)
    setTags(tags)
    setLoading(false)
    navigate('/dashboard')
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    clearSessionKey()
    clearAuth()
    setNotes([])
    setNotebooks([])
    setTags([])
    navigate('/login')
  }

  return { signup, login, googleLogin, logout, loading, error, setError }
}
