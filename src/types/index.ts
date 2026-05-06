export type ViewMode = 'day' | 'week' | 'month' | 'year'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  hidden: boolean
  ring: number // which ring (0 = innermost)
  syncToGcal: boolean
  skipDays?: number[]
}

export interface RecurrenceRule {
  interval: number
  unit: 'days' | 'weeks' | 'months' | 'years'
  endDate?: string  // YYYY-MM-DD
}

export interface CalendarEvent {
  id: string
  title: string
  itemType: 'event' | 'task'
  categoryId: string
  date: string       // ISO date string YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD (for multi-day tasks/events)
  time?: string      // HH:MM
  endTime?: string   // HH:MM
  allDay?: boolean
  durationDays?: number
  durationHours?: number
  durationMinutes?: number
  note?: string
  priority: 'L' | 'N' | 'H' | 'U'
  done: boolean
  links: string[]
  files: FileAttachment[]
  reminder?: number  // minutes before
  parentId?: string   // ID of parent task (sub-task hierarchy)
  dependsOn?: string // event id
  dependsType?: 'FS' | 'SS' | 'FF' | 'SF'
  lag?: number       // hours between events
  lagForce?: boolean // force timing by dependency
  gcalId?: string
  location?: string
  recurrence?: RecurrenceRule
  recurrenceParentId?: string  // id of master recurring event
  rsvpStatus?: 'pending' | 'accepted' | 'declined' | 'tentative'
  sortIndex?: number
  subCategories?: Category[]
}

export interface FileAttachment {
  name: string
  dataUrl: string
  type: string
}

export interface CriticalTime {
  day: number    // hours
  week: number   // days
  month: number  // days
  year: number   // months
}

export interface AppSettings {
  language: string
  showDepLinks: boolean
  criticalTime: CriticalTime
  defaultMode: ViewMode
  geminiApiKey?: string
  darkMode?: boolean
  notificationsEnabled?: boolean
  notifyMinutesBefore?: number[] // e.g. [10, 60, 1440]
  autoSyncGcal?: boolean
}
