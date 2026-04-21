import { useReducer, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent, ViewMode } from '../../types'

interface Props {
  onTap: (ev: CalendarEvent) => void
}

function periodBounds(mode: ViewMode, viewDate: Date): { from: string; to: string } {
  const d = new Date(viewDate)
  if (mode === 'day') {
    const s = d.toISOString().slice(0, 10)
    return { from: s, to: s }
  }
  if (mode === 'week') {
    const day = d.getDay()
    const sun = new Date(d); sun.setDate(d.getDate() - day)
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6)
    return { from: sun.toISOString().slice(0, 10), to: sat.toISOString().slice(0, 10) }
  }
  if (mode === 'month') {
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { from, to }
  }
  // year
  const from = `${d.getFullYear()}-01-01`
  const to   = `${d.getFullYear()}-12-31`
  return { from, to }
}

function dayLabel(
  ev: CalendarEvent,
  tr: ReturnType<typeof import('../../i18n/translations').getLang>
): { text: string; hot: boolean } {
  const nowMs = Date.now()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const evDate = new Date(ev.date + 'T00:00:00')
  const diffDays = Math.round((evDate.getTime() - todayStart.getTime()) / 86_400_000)

  if (diffDays === 0 && ev.time) {
    const evMs = new Date(ev.date + `T${ev.time}:00`).getTime()
    const diffMin = Math.round((evMs - nowMs) / 60_000)
    if (diffMin <= 0) return { text: tr.today, hot: true }
    if (diffMin < 60) return { text: `${diffMin}′`, hot: true }
    const hrs = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return { text: mins > 0 ? `${hrs}:${String(mins).padStart(2, '0')}` : `${hrs}h`, hot: true }
  }
  if (diffDays === 0)  return { text: tr.today,    hot: true  }
  if (diffDays === 1)  return { text: tr.tomorrow,  hot: false }
  if (diffDays === -1) return { text: tr.agoDays + ' 1 ' + tr.unitDays, hot: false }
  if (diffDays > 0 && diffDays < 60)  return { text: `${tr.inDays} ${diffDays} ${tr.unitDays}`, hot: false }
  if (diffDays < 0 && diffDays > -60) return { text: `${tr.agoDays} ${-diffDays} ${tr.unitDays}`, hot: false }
  const months = Math.round(Math.abs(diffDays) / 30)
  return { text: diffDays > 0 ? `${tr.inDays} ${months} ${tr.unitMonths}` : `${tr.agoDays} ${months} ${tr.unitMonths}`, hot: false }
}

export default function UpcomingStrip({ onTap }: Props) {
  const { events, categories, mode, viewDate } = useAppStore()
  const { tr, rtl } = useLang()
  const [, tick] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const { from, to } = periodBounds(mode, viewDate)
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  const periodEvents = events
    .filter(e => !e.done && e.date >= from && e.date <= to)
    .sort((a, b) => {
      const da = a.date + (a.time ?? '00:00')
      const db = b.date + (b.time ?? '00:00')
      return da < db ? -1 : da > db ? 1 : 0
    })
    .slice(0, 30)

  const isPast = to < new Date().toISOString().slice(0, 10)

  return (
    <div
      className="flex-shrink-0 flex gap-1.5 overflow-x-auto px-2.5 py-1.5 bg-white border-b border-gray-100"
      dir={rtl ? 'rtl' : 'ltr'}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {periodEvents.length === 0 && (
        <span className="text-[10px] text-gray-300 font-medium px-1 py-0.5">
          {rtl
            ? (isPast ? 'אין אירועים בתקופה זו' : 'אין אירועים קרובים')
            : (isPast ? 'No events in this period' : 'No upcoming events')}
        </span>
      )}
      {periodEvents.map(ev => {
        const cat = catMap[ev.categoryId]
        const color = cat?.color ?? '#888'
        const { text: dayText, hot } = dayLabel(ev, tr)

        return (
          <button
            key={ev.id}
            onClick={() => onTap(ev)}
            className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 active:opacity-70 transition-opacity"
            style={{ backgroundColor: color + '14', border: `1px solid ${color}33` }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-bold max-w-[80px] truncate" style={{ color }}>
              {ev.title}
            </span>
            {ev.time && (
              <span className="text-[10px] font-mono font-semibold text-gray-400 flex-shrink-0">
                {ev.time}
              </span>
            )}
            <span className={`text-[9px] font-black rounded px-1 py-0.5 flex-shrink-0 ${
              hot ? 'bg-red-500 text-white' : isPast ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-400'
            }`}>
              {dayText}
            </span>
          </button>
        )
      })}
    </div>
  )
}
