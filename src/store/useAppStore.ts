import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { get, set as idbSet, del } from 'idb-keyval'
import type { CalendarEvent, Category, AppSettings, ViewMode, CriticalTime, RecurrenceRule } from '../types'

// IndexedDB storage adapter — survives "Clear cache" (only "Clear data" erases it)
const idbStorage = {
  getItem: async (name: string) => (await get(name)) ?? null,
  setItem: async (name: string, value: string) => { await idbSet(name, value) },
  removeItem: async (name: string) => { await del(name) },
}

function computeRollupDays(parentId: string, events: CalendarEvent[]): number {
  const children = events.filter(e => e.parentId === parentId && !e.done)
  if (children.length === 0) return 0
  const memo = new Map<string, number>()
  const visiting = new Set<string>()
  const ef = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!
    if (visiting.has(id)) return 1 // cycle — break with default duration
    const ev = children.find(e => e.id === id)
    if (!ev) return 0
    const dur = ev.durationDays ?? 1
    if (!ev.dependsOn) { memo.set(id, dur); return dur }
    const dep = children.find(e => e.id === ev.dependsOn)
    if (!dep) { memo.set(id, dur); return dur }
    visiting.add(id)
    const depEF = ef(dep.id)
    visiting.delete(id)
    const depDur = dep.durationDays ?? 1
    const lagDays = Math.round((ev.lag ?? 0) / 24)
    let start: number
    switch (ev.dependsType ?? 'FS') {
      case 'FS': start = depEF + lagDays; break
      case 'SS': start = depEF - depDur + lagDays; break
      case 'FF': start = depEF - dur + lagDays; break
      case 'SF': start = depEF - depDur - dur + lagDays; break
      default: start = depEF + lagDays
    }
    const result = Math.max(0, start) + dur
    memo.set(id, result)
    return result
  }
  let maxEF = 0
  for (const child of children) maxEF = Math.max(maxEF, ef(child.id))
  return maxEF
}

function applyRollup(events: CalendarEvent[]): CalendarEvent[] {
  const parentIds = new Set(events.filter(e => e.parentId).map(e => e.parentId!))
  if (parentIds.size === 0) return events
  return events.map(e => {
    if (!parentIds.has(e.id)) return e
    const rollup = computeRollupDays(e.id, events)
    if (rollup === 0) return e
    const endDate = new Date(e.date + 'T00:00:00')
    endDate.setDate(endDate.getDate() + rollup - 1)
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    return { ...e, durationDays: rollup, endDate: endStr }
  })
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateInstances(master: CalendarEvent): CalendarEvent[] {
  const rule: RecurrenceRule | undefined = master.recurrence
  if (!rule) return []
  const { interval, unit, endDate } = rule
  if (interval <= 0) return []
  const masterDate = new Date(master.date + 'T00:00:00')
  const maxDateStr = endDate ?? (() => {
    const d = new Date(masterDate); d.setFullYear(d.getFullYear() + 2); return localDateStr(d)
  })()
  const originalDay   = masterDate.getDate()
  const originalMonth = masterDate.getMonth()
  const instances: CalendarEvent[] = []
  const cur = new Date(masterDate)
  while (true) {
    if (unit === 'days')  cur.setDate(cur.getDate() + interval)
    else if (unit === 'weeks') cur.setDate(cur.getDate() + interval * 7)
    else if (unit === 'months') {
      // setMonth(cur+n) overflows day (e.g. Jan 31 → Mar 2) — compute explicitly
      const rawMonth = cur.getMonth() + interval
      const nextYear  = cur.getFullYear() + Math.floor(rawMonth / 12)
      const nextMonth = ((rawMonth % 12) + 12) % 12
      const lastDay   = new Date(nextYear, nextMonth + 1, 0).getDate()
      cur.setFullYear(nextYear, nextMonth, Math.min(originalDay, lastDay))
    }
    else if (unit === 'years') {
      // setFullYear overflows day on Feb 29 in non-leap years — clamp to month's last day
      const nextYear = cur.getFullYear() + interval
      const lastDay  = new Date(nextYear, originalMonth + 1, 0).getDate()
      cur.setFullYear(nextYear, originalMonth, Math.min(originalDay, lastDay))
    }
    else break // unknown unit — stop to prevent infinite loop
    const curStr = localDateStr(cur)
    if (curStr > maxDateStr) break
    instances.push({ ...master, id: crypto.randomUUID(), date: curStr, recurrenceParentId: master.id, done: false })
    if (instances.length >= 1000) break // safety cap
  }
  return instances
}

const DEFAULT_CATS: Category[] = [
  { id: 'work',     name: 'עבודה',                    color: '#4285f4', icon: '💼', hidden: false, ring: 3, syncToGcal: true },
  { id: 'study',    name: 'לימודים',                  color: '#8e44ad', icon: '📚', hidden: false, ring: 2, syncToGcal: true },
  { id: 'holiday',  name: 'חגים/ימי הולדת/חופשות',   color: '#e74c3c', icon: '🎉', hidden: false, ring: 1, syncToGcal: true },
  { id: 'personal', name: 'אישי',                     color: '#27ae60', icon: '🏠', hidden: false, ring: 0, syncToGcal: false },
]

const DEFAULT_SETTINGS: AppSettings = {
  language: 'he',
  showDepLinks: true,
  criticalTime: { day: 2, week: 2, month: 7, year: 2 },
  defaultMode: 'week',
  darkMode: false,
  notificationsEnabled: true,
  notifyMinutesBefore: [60, 1440],
  autoSyncGcal: true,
}

interface AppState {
  events: CalendarEvent[]
  categories: Category[]
  settings: AppSettings
  mode: ViewMode
  needle: Date
  viewDate: Date

  spiralGeneration: number
  bumpSpiralGeneration: () => void

  subCalendarParentId: string | null
  setSubCalendarParentId: (id: string | null) => void

  gcalConnected: boolean
  setGcalConnected: (v: boolean) => void
  patchEventGcalId: (id: string, gcalId: string) => void

  deletedGcalIds: string[]
  markGcalIdDeleted: (gcalId: string) => void

  // Actions
  addEvent: (ev: Omit<CalendarEvent, 'id'>) => string
  addRecurringEvent: (ev: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  batchUpdateSortOrder: (updates: { id: string; sortIndex: number }[]) => void
  deleteEvent: (id: string) => void
  deleteEventCascade: (id: string) => void
  setMode: (mode: ViewMode) => void
  setNeedle: (date: Date) => void
  setViewDate: (date: Date) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  soloCategory: (id: string | null) => void
  addCategory: (cat: Omit<Category, 'id'>) => void
  deleteCategory: (id: string) => void
  reorderCategory: (id: string, dir: -1 | 1) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  updateCriticalTime: (patch: Partial<CriticalTime>) => void
  importData: (data: { events?: CalendarEvent[]; categories?: Category[]; settings?: Partial<AppSettings> }) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, _get) => ({
      events: [],
      categories: DEFAULT_CATS,
      settings: DEFAULT_SETTINGS,
      mode: 'week',
      needle: new Date(),
      viewDate: new Date(),
      spiralGeneration: 0,
      bumpSpiralGeneration: () => set(s => ({ spiralGeneration: s.spiralGeneration + 1 })),

      subCalendarParentId: null,
      setSubCalendarParentId: (id) => set({ subCalendarParentId: id }),

      gcalConnected: false,

      setGcalConnected: (v) => set({ gcalConnected: v }),

      patchEventGcalId: (id, gcalId) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, gcalId } : e)),
        })),

      deletedGcalIds: [],

      markGcalIdDeleted: (gcalId) =>
        set((s) => ({
          deletedGcalIds: s.deletedGcalIds.includes(gcalId)
            ? s.deletedGcalIds
            : [...s.deletedGcalIds, gcalId],
        })),

      addEvent: (ev) => {
        const id = crypto.randomUUID()
        set((s) => ({ events: applyRollup([...s.events, { ...ev, id }]) }))
        return id
      },

      addRecurringEvent: (ev) => {
        const master: CalendarEvent = { ...ev, id: crypto.randomUUID() }
        const instances = generateInstances(master)
        set((s) => ({ events: applyRollup([...s.events, master, ...instances]) }))
      },

      updateEvent: (id, patch) =>
        set((s) => ({
          events: applyRollup(s.events.map((e) => (e.id === id ? { ...e, ...patch } : e))),
        })),

      batchUpdateSortOrder: (updates) => {
        const map = new Map(updates.map(u => [u.id, u.sortIndex]))
        set((s) => ({
          events: s.events.map((e) => map.has(e.id) ? { ...e, sortIndex: map.get(e.id) } : e),
        }))
      },

      deleteEvent: (id) =>
        set((s) => {
          const ev = s.events.find(e => e.id === id)
          const gcalId = ev?.gcalId
          return {
            events: applyRollup(s.events.filter((e) => e.id !== id)),
            deletedGcalIds: gcalId && !s.deletedGcalIds.includes(gcalId)
              ? [...s.deletedGcalIds, gcalId]
              : s.deletedGcalIds,
          }
        }),

      deleteEventCascade: (id) =>
        set((s) => ({ events: applyRollup(s.events.filter((e) => e.id !== id && e.recurrenceParentId !== id)) })),

      setMode: (mode) => { const n = new Date(); set({ mode, needle: n, viewDate: n }) },

      setNeedle: (needle) => set({ needle }),

      setViewDate: (viewDate) => set({ viewDate }),

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      soloCategory: (id) =>
        set((s) => ({
          categories: s.categories.map((c) => ({ ...c, hidden: id !== null && c.id !== id })),
        })),

      addCategory: (cat) =>
        set((s) => ({
          categories: [...s.categories, { ...cat, id: crypto.randomUUID() }],
        })),

      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
        })),

      reorderCategory: (id, dir) =>
        set((s) => {
          const sorted = [...s.categories].sort((a, b) => a.ring - b.ring)
          const idx = sorted.findIndex((c) => c.id === id)
          const swapIdx = idx + dir
          if (swapIdx < 0 || swapIdx >= sorted.length) return s
          const ringA = sorted[idx].ring
          const ringB = sorted[swapIdx].ring
          return {
            categories: s.categories.map((c) => {
              if (c.id === sorted[idx].id) return { ...c, ring: ringB }
              if (c.id === sorted[swapIdx].id) return { ...c, ring: ringA }
              return c
            }),
          }
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      updateCriticalTime: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            criticalTime: { ...s.settings.criticalTime, ...patch },
          },
        })),

      importData: (data) =>
        set((s) => ({
          events:     data.events     ? applyRollup(data.events.map(e => ({ ...e, itemType: e.itemType ?? 'event' }))) : s.events,
          categories: data.categories ?? s.categories,
          settings:   data.settings   ? { ...s.settings, ...data.settings, criticalTime: { ...s.settings.criticalTime, ...data.settings.criticalTime } } : s.settings,
        })),

    }),
    {
      name: 'spiral-diary',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        events: s.events,
        categories: s.categories,
        settings: s.settings,
        gcalConnected: s.gcalConnected,
        deletedGcalIds: s.deletedGcalIds,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          mode: 'week',
          deletedGcalIds: p.deletedGcalIds ?? [],
          // Migrate legacy events: make itemType explicit so filters are unambiguous
          events: (p.events ?? []).map(e => ({
            ...e,
            itemType: e.itemType ?? 'event',
          })),
          settings: {
            ...current.settings,
            ...p.settings,
            criticalTime: {
              ...current.settings.criticalTime,
              ...p.settings?.criticalTime,
            },
          },
        }
      },
    }
  )
)
