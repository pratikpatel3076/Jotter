let _sw: ServiceWorkerRegistration | null = null

export async function initNotifications(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  try {
    _sw = await navigator.serviceWorker.register('/sw-notifications.js', { scope: '/' })
    return true
  } catch {
    return false
  }
}

export async function scheduleReminder(opts: {
  id: string
  title: string
  body?: string
  fire_at: string
  url?: string
}) {
  if (!_sw) {
    _sw = await navigator.serviceWorker.getRegistration('/sw-notifications.js') ?? null
  }
  if (!_sw?.active) {
    // Fallback: use setTimeout for short-lived reminders (≤10 min)
    const delay = new Date(opts.fire_at).getTime() - Date.now()
    if (delay > 0 && delay <= 10 * 60 * 1000) {
      setTimeout(() => {
        new Notification(opts.title, { body: opts.body, icon: '/icons/icon-192x192.png' })
      }, delay)
    }
    return
  }
  _sw.active.postMessage({ type: 'SCHEDULE_REMINDER', payload: opts })
}

export function cancelReminder(id: string) {
  _sw?.active?.postMessage({ type: 'CANCEL_REMINDER', payload: { id } })
}

export function showInstantNotification(title: string, body?: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icons/icon-192x192.png' })
  }
}
