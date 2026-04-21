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

export interface CalendarEvent {
  id: string
  title: string
  categoryId: string
  date: string       // ISO date string YYYY-MM-DD
  time?: string      // HH:MM
  endTime?: string   // HH:MM
  durationDays?: number
  durationHours?: number
  durationMinutes?: number
  note?: string
  priority: 'L' | 'N' | 'H' | 'U'
  done: boolean
  links: string[]
  files: FileAttachment[]
  reminder?: number  // minutes before
  dependsOn?: string // event id
  dependsType?: 'FS' | 'SS' | 'FF' | 'SF'
  lag?: number       // hours between events
  lagForce?: boolean // force timing by dependency
  gcalId?: string
  location?: string
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
}
