// Local notifications service (Capacitor)
import type { CalendarEvent } from '../types'

type NotifPlugin = {
  requestPermissions(): Promise<{ display: string }>
  checkPermissions(): Promise<{ display: string }>
  schedule(opts: { notifications: NotifItem[] }): Promise<void>
  cancel(opts: { notifications: { id: number }[] }): Promise<void>
  getPending(): Promise<{ notifications: { id: number }[] }>
}

interface NotifItem {
  id: number
  title: string
  body: string
  schedule: { at: Date }
  sound?: string
  extra?: Record<string, string>
}

let plugin: NotifPlugin | null = null

async function getPlugin(): Promise<NotifPlugin | null> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    plugin = LocalNotifications as unknown as NotifPlugin
    return plugin
  } catch {
    return null
  }
}

export async function requestPermission(): Promise<boolean> {
  const p = await getPlugin()
  if (!p) return false
  try {
    const { display } = await p.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

// Stable numeric ID from event id string
function eventToNotifId(eventId: string, offset: number): number {
  let h = offset * 1_000_000
  for (let i = 0; i < Math.min(eventId.length, 8); i++) h = (h * 31 + eventId.charCodeAt(i)) & 0x7fffffff
  return h
}

export async function scheduleEventNotifications(ev: CalendarEvent, minutesBefore: number[]): Promise<void> {
  const p = await getPlugin()
  if (!p) return
  if (ev.done || !ev.date) return

  const { display } = await p.checkPermissions()
  if (display !== 'granted') return

  const evDate = new Date(ev.date + 'T' + (ev.time ?? '09:00') + ':00')
  const now = Date.now()

  const toSchedule: NotifItem[] = []
  for (let i = 0; i < minutesBefore.length; i++) {
    const fireAt = new Date(evDate.getTime() - minutesBefore[i] * 60_000)
    if (fireAt.getTime() <= now) continue
    const label = minutesBefore[i] >= 1440
      ? `${minutesBefore[i] / 1440} ${minutesBefore[i] / 1440 === 1 ? 'יום' : 'ימים'} לפני`
      : minutesBefore[i] >= 60
      ? `${minutesBefore[i] / 60} שעות לפני`
      : `${minutesBefore[i]} דקות לפני`
    toSchedule.push({
      id: eventToNotifId(ev.id, i),
      title: `⏰ ${ev.title}`,
      body: `${label} · ${ev.date.slice(5).replace('-', '/')}${ev.time ? ' ' + ev.time : ''}${ev.location ? ' · ' + ev.location : ''}`,
      schedule: { at: fireAt },
      extra: { eventId: ev.id },
    })
  }
  if (toSchedule.length > 0) await p.schedule({ notifications: toSchedule })
}

export async function cancelEventNotifications(eventId: string): Promise<void> {
  const p = await getPlugin()
  if (!p) return
  const ids = [0, 1, 2].map(i => ({ id: eventToNotifId(eventId, i) }))
  await p.cancel({ notifications: ids }).catch(() => {})
}

export async function rescheduleAll(
  events: CalendarEvent[],
  minutesBefore: number[],
): Promise<void> {
  const p = await getPlugin()
  if (!p) return
  const { display } = await p.checkPermissions()
  if (display !== 'granted') return

  // Cancel all pending
  const { notifications: pending } = await p.getPending()
  if (pending.length > 0) await p.cancel({ notifications: pending }).catch(() => {})

  // Re-schedule upcoming non-done events
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcoming = events.filter(e => !e.done && new Date(e.date + 'T00:00:00') >= today)
  for (const ev of upcoming) {
    // Use per-event reminder if set, otherwise fall back to global schedule
    const mins = ev.reminder !== undefined ? [ev.reminder] : minutesBefore
    await scheduleEventNotifications(ev, mins)
  }
}
