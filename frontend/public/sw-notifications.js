// Service Worker for Jotter push notifications and reminder scheduling
const REMINDERS_KEY = 'jotter_reminders'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  if (type === 'SCHEDULE_REMINDER') {
    scheduleReminder(payload)
  }

  if (type === 'CANCEL_REMINDER') {
    cancelReminder(payload.id)
  }

  if (type === 'GET_REMINDERS') {
    getReminders().then((reminders) => {
      event.source?.postMessage({ type: 'REMINDERS_LIST', reminders })
    })
  }
})

// Handle push events (server-sent)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Jotter', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: data.tag ?? 'jotter',
      data: data.url ? { url: data.url } : undefined,
    }),
  )
})

// Notification click — open note
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    }),
  )
})

// ── Persistent reminder storage using IndexedDB ──────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sw_reminders', 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('reminders', { keyPath: 'id' })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = reject
  })
}

async function getReminders() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readonly')
    const req = tx.objectStore('reminders').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = reject
  })
}

async function scheduleReminder(reminder) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite')
    tx.objectStore('reminders').put(reminder)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
  checkReminders()
}

async function cancelReminder(id) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite')
    tx.objectStore('reminders').delete(id)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}

async function checkReminders() {
  const reminders = await getReminders()
  const now = Date.now()
  for (const r of reminders) {
    const fireAt = new Date(r.fire_at).getTime()
    if (fireAt <= now + 60000) {
      // Fire now or within 1 min
      const delay = Math.max(0, fireAt - now)
      setTimeout(async () => {
        await self.registration.showNotification(r.title, {
          body: r.body ?? '',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: r.id,
          data: r.url ? { url: r.url } : undefined,
        })
        await cancelReminder(r.id)
      }, delay)
    }
  }
}

// Check reminders every minute
setInterval(checkReminders, 60000)
checkReminders()
