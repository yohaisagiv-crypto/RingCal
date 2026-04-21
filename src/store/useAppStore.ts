import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEvent, Category, AppSettings, ViewMode, CriticalTime } from '../types'

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
}

interface AppState {
  events: CalendarEvent[]
  categories: Category[]
  settings: AppSettings
  mode: ViewMode
  needle: Date
  viewDate: Date

  gcalConnected: boolean
  setGcalConnected: (v: boolean) => void
  patchEventGcalId: (id: string, gcalId: string) => void

  // Actions
  addEvent: (ev: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  setMode: (mode: ViewMode) => void
  setNeedle: (date: Date) => void
  setViewDate: (date: Date) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  addCategory: (cat: Omit<Category, 'id'>) => void
  deleteCategory: (id: string) => void
  reorderCategory: (id: string, dir: -1 | 1) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  updateCriticalTime: (patch: Partial<CriticalTime>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      events: [],
      categories: DEFAULT_CATS,
      settings: DEFAULT_SETTINGS,
      mode: 'week',
      needle: new Date(),
      viewDate: new Date(),
      gcalConnected: false,

      setGcalConnected: (v) => set({ gcalConnected: v }),

      patchEventGcalId: (id, gcalId) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, gcalId } : e)),
        })),

      addEvent: (ev) =>
        set((s) => ({
          events: [...s.events, { ...ev, id: crypto.randomUUID() }],
        })),

      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      setMode: (mode) => set({ mode, needle: new Date() }),

      setNeedle: (needle) => set({ needle }),

      setViewDate: (viewDate) => set({ viewDate }),

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
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

    }),
    {
      name: 'spiral-diary',
      partialize: (s) => ({
        events: s.events,
        categories: s.categories,
        settings: s.settings,
        mode: s.mode,
        gcalConnected: s.gcalConnected,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...p.settings,
            criticalTime: {
              ...current.settings.criticalTime,   // defaults (כולל year: 2)
              ...p.settings?.criticalTime,         // ערכים שמורים
            },
          },
        }
      },
    }
  )
)
