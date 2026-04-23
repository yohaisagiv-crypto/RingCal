// Google Calendar sync service
//
// כמפתח — צריך לעשות פעם אחת:
// 1. https://console.cloud.google.com → New Project
// 2. Enable Google Calendar API
// 3. Credentials → OAuth 2.0 Client ID → Web application
// 4. Authorized JavaScript origins: http://localhost:3000
// 5. Authorized redirect URIs: http://localhost:3000/oauth
// 6. להכניס את ה-Client ID בקובץ .env: VITE_GOOGLE_CLIENT_ID=...
//
// המשתמש הסופי רואה רק: לחיצה → בחר חשבון גוגל → אשר → סיים.

import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'

const CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE       = 'https://www.googleapis.com/auth/calendar'
const isNative    = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
const REDIRECT    = isNative ? 'https://ring-cal.vercel.app/oauth' : (window.location.origin + '/oauth')
console.log('[gcal] redirect_uri =', REDIRECT)
const TOKEN_KEY   = 'gcal_token'
const SYNC_KEY    = 'gcal_sync_from'

// ── Token storage ──────────────────────────────────────────────────────────

export const getToken    = () => localStorage.getItem(TOKEN_KEY)
export const isConnected = () => !!getToken()
export const getSyncFrom = () => localStorage.getItem(SYNC_KEY)
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SYNC_KEY)
}

// ── OAuth sign-in ──────────────────────────────────────────────────────────
// On Android: opens an in-app browser (native sheet), user picks account + approves.
// On web:     opens a small browser window.

export function authorize(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('חסר VITE_GOOGLE_CLIENT_ID — ראה קובץ .env.example'))
      return
    }

    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT,
      response_type: 'token',
      scope:         SCOPE,
      prompt:        'select_account',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

    // Listen for redirect (Capacitor or browser hash)
    const handleUrl = (url: string) => {
      if (!url.includes('access_token')) return
      const fragment = url.split('#')[1] ?? ''
      const query = url.split('?')[1]?.split('#')[0] ?? ''
      const hash = new URLSearchParams(fragment || query)
      const token = hash.get('access_token')
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        Browser.close().catch(() => {})
        resolve(token)
      }
    }

    // Capacitor native: listen for appUrlOpen
    const listenerPromise = App.addListener('appUrlOpen', (data) => {
      listenerPromise.then(h => h.remove())
      handleUrl(data.url)
    })

    // Web browser: receive token via postMessage from /oauth popup
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
      if (typeof ev.data === 'string' && ev.data.includes('access_token')) {
        window.removeEventListener('message', onMessage)
        handleUrl(ev.data)
      }
    }
    window.addEventListener('message', onMessage)

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      listenerPromise.then(h => h.remove()).catch(() => {})
      Browser.close().catch(() => {})
      reject(new Error('פג הזמן — נסה שוב'))
    }, 3 * 60 * 1000)

    resolve = ((orig) => (token: string) => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      orig(token)
    })(resolve)

    Browser.open({ url: authUrl, presentationStyle: 'popover' }).catch(() => {
      window.open(authUrl, '_blank', 'width=480,height=620')
    })
  })
}

// ── Calendar API ───────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = getToken()
  if (!token) throw new Error('לא מחובר')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (res.status === 401) { clearAuth(); throw new Error('פג תוקף החיבור — התחבר מחדש') }
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`שגיאת Google Calendar: ${res.status}`)
  return res.json()
}

export type GcalEventRaw = {
  id: string
  summary?: string
  description?: string
  location?: string
  status?: string
  start: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

export async function fetchFutureEvents(since: Date): Promise<GcalEventRaw[]> {
  const all: GcalEventRaw[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      timeMin: since.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '1000',
      ...(pageToken ? { pageToken } : {}),
    })
    const data = await apiFetch(`/calendars/primary/events?${params}`) as { items?: GcalEventRaw[]; nextPageToken?: string }
    all.push(...(data?.items ?? []).filter(e => e.status !== 'cancelled'))
    pageToken = data?.nextPageToken
  } while (pageToken)

  return all
}

export async function createEvent(ev: {
  title: string; date: string; time?: string; endTime?: string; note?: string; location?: string
}): Promise<string> {
  const data = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(toBody(ev)),
  }) as { id: string }
  return data.id
}

export async function updateEvent(gcalId: string, ev: {
  title: string; date: string; time?: string; endTime?: string; note?: string; location?: string
}): Promise<void> {
  await apiFetch(`/calendars/primary/events/${gcalId}`, {
    method: 'PUT',
    body: JSON.stringify(toBody(ev)),
  })
}

export async function deleteEvent(gcalId: string): Promise<void> {
  await apiFetch(`/calendars/primary/events/${gcalId}`, { method: 'DELETE' })
}

// ── Type helpers ───────────────────────────────────────────────────────────

function toBody(ev: { title: string; date: string; time?: string; endTime?: string; note?: string; location?: string }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const loc = ev.location ? { location: ev.location } : {}
  if (ev.time) {
    return {
      summary: ev.title, description: ev.note ?? '', ...loc,
      start: { dateTime: `${ev.date}T${ev.time}:00`, timeZone: tz },
      end:   { dateTime: `${ev.date}T${ev.endTime ?? ev.time}:00`, timeZone: tz },
    }
  }
  const d = new Date(ev.date); d.setDate(d.getDate() + 1)
  const nextDay = d.toISOString().slice(0, 10)
  return {
    summary: ev.title, description: ev.note ?? '', ...loc,
    start: { date: ev.date },
    end:   { date: nextDay },
  }
}

export function fromGcalEvent(ev: GcalEventRaw) {
  const s = ev.start.dateTime ?? ev.start.date ?? ''
  const e = ev.end?.dateTime  ?? ev.end?.date  ?? ''
  return {
    gcalId:  ev.id,
    title:   ev.summary ?? '(ללא שם)',
    date:    s.slice(0, 10),
    time:    ev.start.dateTime ? s.slice(11, 16) : undefined,
    endTime: ev.end?.dateTime  ? e.slice(11, 16) : undefined,
    note:     ev.description ?? '',
    location: ev.location,
  }
}

// ── First-time two-way sync ────────────────────────────────────────────────

export async function initialSync(
  localFutureEvents: Array<{
    id: string; title: string; date: string; time?: string
    endTime?: string; note?: string; gcalId?: string; categoryId: string
  }>,
  blockedCategories: Set<string>,
  onImport: (ev: ReturnType<typeof fromGcalEvent>) => void,
  onExport: (localId: string, gcalId: string) => void,
): Promise<void> {
  const since = new Date()
  localStorage.setItem(SYNC_KEY, since.toISOString())

  const gcalEvents = await fetchFutureEvents(since)
  const existingGcalIds = new Set(localFutureEvents.map(e => e.gcalId).filter(Boolean))

  // Google → app
  for (const ge of gcalEvents) {
    if (!existingGcalIds.has(ge.id)) {
      onImport(fromGcalEvent(ge))
    }
  }

  // app → Google
  for (const le of localFutureEvents) {
    if (le.gcalId) continue
    if (blockedCategories.has(le.categoryId)) continue
    const gcalId = await createEvent(le)
    onExport(le.id, gcalId)
  }
}
