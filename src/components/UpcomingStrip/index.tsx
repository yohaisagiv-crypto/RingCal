import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent } from '../../types'

interface Props {
  onTap: (ev: CalendarEvent) => void
}

function timeLabel(ev: CalendarEvent, tr: ReturnType<typeof import('../../i18n/translations').getLang>): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const evDate = new Date(ev.date + 'T00:00:00')
  const diffMs = evDate.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (diffDays === 0) {
    if (ev.time) return ev.time
    return tr.today
  }
  if (diffDays === 1) return tr.tomorrow
  if (diffDays < 60) return `${tr.inDays} ${diffDays} ${tr.unitDays}`
  const months = Math.round(diffDays / 30)
  return `${tr.inDays} ${months} ${tr.unitMonths}`
}

export default function UpcomingStrip({ onTap }: Props) {
  const { events, categories } = useAppStore()
  const { tr, rtl } = useLang()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming = events
    .filter(e => !e.done && new Date(e.date + 'T00:00:00') >= today)
    .sort((a, b) => {
      const da = a.date + (a.time ?? '00:00')
      const db = b.date + (b.time ?? '00:00')
      return da < db ? -1 : da > db ? 1 : 0
    })
    .slice(0, 20)

  if (upcoming.length === 0) return null

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return (
    <div
      className="flex gap-2 overflow-x-auto px-3 py-1.5 scrollbar-none"
      dir={rtl ? 'rtl' : 'ltr'}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
    >
      {upcoming.map(ev => {
        const cat = catMap[ev.categoryId]
        const color = cat?.color ?? '#888'
        const label = timeLabel(ev, tr)
        const isToday = label === tr.today || (ev.time !== undefined && new Date(ev.date + 'T00:00:00').getTime() === today.getTime())

        return (
          <button
            key={ev.id}
            onClick={() => onTap(ev)}
            className="flex-shrink-0 flex items-center gap-1.5 bg-white rounded-full shadow-sm border border-gray-100 px-2.5 py-1 active:scale-95 transition-transform"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            {/* color dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {/* title */}
            <span className="text-xs font-semibold text-gray-800 max-w-[90px] truncate">
              {ev.title}
            </span>
            {/* time badge */}
            <span
              className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0 ${
                isToday
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
