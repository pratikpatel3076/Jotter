const GIS_SRC = 'https://accounts.google.com/gsi/client'
export const GOOGLE_OIDC_SCOPES = 'openid email profile'
export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export async function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts) return
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

export async function requestGoogleIdToken(): Promise<string> {
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('Google Sign-In is not configured')
  await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    window.google!.accounts.id.initialize({
      client_id: clientId,
      scope: GOOGLE_OIDC_SCOPES,
      callback: (response) => {
        if (response.credential) resolve(response.credential)
        else reject(new Error('Google did not return an ID token'))
      },
    })
    window.google!.accounts.id.prompt()
  })
}

export async function requestDriveAppDataToken(): Promise<{ access_token: string; expires_in?: number; scope: string }> {
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('Google Drive connection is not configured')
  await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) reject(new Error(response.error ?? 'Google Drive authorization failed'))
        else resolve({
          access_token: response.access_token,
          expires_in: response.expires_in,
          scope: response.scope ?? GOOGLE_DRIVE_APPDATA_SCOPE,
        })
      },
    })
    tokenClient.requestAccessToken()
  })
}
