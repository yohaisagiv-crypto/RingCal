import { useReducer, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { localISODate } from '../../hooks/useSpiralMath'
import type { CalendarEvent } from '../../types'

interface Props {
  onTap: (ev: CalendarEvent) => void
  eventsOverride?: CalendarEvent[]
}

function timeRemaining(
  ev: CalendarEvent,
  mode: string,
  tr: ReturnType<typeof import('../../i18n/translations').getLang>
): { text: string; hot: boolean } {
  const nowMs = Date.now()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const evDate = new Date(ev.date + 'T00:00:00')
  const diffMs = evDate.getTime() - todayStart.getTime()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (mode === 'day') {
    // Show hours remaining
    const evMs = ev.time
      ? new Date(ev.date + `T${ev.time}:00`).getTime()
      : evDate.getTime()
    const diffMin = Math.round((evMs - nowMs) / 60_000)
    if (diffMin <= 0) return { text: tr.today, hot: true }
    if (diffMin < 60) return { text: `${diffMin}′`, hot: true }
    const hrs = diffMin / 60
    const hFrac = hrs % 1
    const hInt = Math.floor(hrs)
    const fracStr = hFrac > 0.1 ? `.${Math.round(hFrac * 10)}` : ''
    return { text: `${hInt}${fracStr}${tr.timeLeftHours}`, hot: hrs < 3 }
  }

  if (mode === 'week') {
    if (diffDays <= 0) {
      if (ev.time?.trim()) {
        const evMs = new Date(ev.date + `T${ev.time}:00`).getTime()
        const diffMin = Math.round((evMs - nowMs) / 60_000)
        if (diffMin > 0) {
          if (diffMin < 60) return { text: `${diffMin}′`, hot: true }
          const hrs = diffMin / 60
          return { text: `${Math.floor(hrs)}${tr.timeLeftHours}`, hot: hrs < 3 }
        }
      }
      return { text: tr.today, hot: true }
    }
    if (diffDays === 1) return { text: tr.tomorrow, hot: true }
    return { text: `${diffDays}${tr.timeLeftDays}`, hot: diffDays <= 2 }
  }

  if (mode === 'month') {
    if (diffDays <= 0) {
      if (ev.time?.trim()) {
        const evMs = new Date(ev.date + `T${ev.time}:00`).getTime()
        const diffMin = Math.round((evMs - nowMs) / 60_000)
        if (diffMin > 0) {
          if (diffMin < 60) return { text: `${diffMin}′`, hot: true }
          const hrs = diffMin / 60
          return { text: `${Math.floor(hrs)}${tr.timeLeftHours}`, hot: hrs < 3 }
        }
      }
      return { text: tr.today, hot: true }
    }
    if (diffDays < 7) return { text: `${diffDays}${tr.timeLeftDays}`, hot: true }
    const weeks = diffDays / 7
    const wInt = Math.floor(weeks)
    const wFrac = weeks % 1
    const fracStr = wFrac > 0.1 ? `.${Math.round(wFrac * 10)}` : ''
    return { text: `${wInt}${fracStr}${tr.timeLeftWeeks}`, hot: weeks < 1.5 }
  }

  // year mode — show months remaining
  if (diffDays <= 0) {
    if (ev.time?.trim()) {
      const evMs = new Date(ev.date + `T${ev.time}:00`).getTime()
      const diffMin = Math.round((evMs - nowMs) / 60_000)
      if (diffMin > 0) {
        if (diffMin < 60) return { text: `${diffMin}′`, hot: true }
        const hrs = diffMin / 60
        return { text: `${Math.floor(hrs)}${tr.timeLeftHours}`, hot: hrs < 3 }
      }
    }
    return { text: tr.today, hot: true }
  }
  const months = diffDays / 30.5
  if (months < 1) return { text: `${diffDays}${tr.timeLeftDays}`, hot: true }
  const mInt = Math.floor(months)
  const mFrac = months % 1
  const fracStr = mFrac > 0.1 ? `.${Math.round(mFrac * 10)}` : ''
  return { text: `${mInt}${fracStr}${tr.timeLeftMonths}`, hot: months < 1.5 }
}

export default function UpcomingStrip({ onTap, eventsOverride }: Props) {
  const { events: storeEvents, categories, mode, settings, needle } = useAppStore()
  const events = eventsOverride ?? storeEvents
  const { tr, rtl } = useLang()
  const [, tick] = useReducer(x => x + 1, 0)
  const stripRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  const now = new Date()
  const critEnd = new Date(now)
  if (mode === 'day')        critEnd.setHours(critEnd.getHours() + (settings.criticalTime.day ?? 2))
  else if (mode === 'week')  critEnd.setDate(critEnd.getDate() + (settings.criticalTime.week ?? 2))
  else if (mode === 'month') critEnd.setDate(critEnd.getDate() + (settings.criticalTime.month ?? 7))
  else                       critEnd.setMonth(critEnd.getMonth() + (settings.criticalTime.year ?? 2))

  const nowStr     = localISODate(now)
  const critEndStr = localISODate(critEnd)

  const periodEvents = events
    .filter(e => !e.done && e.date >= nowStr && e.date <= critEndStr)
    .sort((a, b) => {
      const da = a.date + (a.time ?? '00:00')
      const db = b.date + (b.time ?? '00:00')
      return da < db ? -1 : 1
    })
    .slice(0, 30)

  // Find the event closest to the needle
  const needleMs = needle.getTime()
  let activeId: string | null = null
  let closestDiff = Infinity
  for (const ev of periodEvents) {
    const evMs = new Date(ev.date + 'T' + (ev.time ?? '00:00') + ':00').getTime()
    const diff = Math.abs(evMs - needleMs)
    if (diff < closestDiff) { closestDiff = diff; activeId = ev.id }
  }

  // Scroll active item into view when needle changes (direct scrollLeft to avoid parent scroll on Android)
  useEffect(() => {
    if (!activeId) return
    const el = itemRefs.current.get(activeId)
    const strip = stripRef.current
    if (el && strip) {
      const targetLeft = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
      strip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    }
  }, [activeId])

  return (
    <div
      ref={stripRef}
      className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b-2 border-gray-200 shadow-sm"
      dir={rtl ? 'rtl' : 'ltr'}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      {periodEvents.length === 0 && (
        <span className="text-xs text-gray-400 font-medium px-1 self-center">
          {tr.noUpcomingInRange}
        </span>
      )}
      {periodEvents.map(ev => {
        const cat = catMap[ev.categoryId]
        const color = cat?.color ?? '#888'
        const { text: timeText, hot } = timeRemaining(ev, mode, tr)
        const isTask = ev.itemType === 'task'
        const isPending = ev.rsvpStatus === 'pending'
        const typeLabel = isTask ? tr.typeTask : tr.typeEvent
        const typeIcon = isPending ? '📬' : (isTask ? '✅' : '📅')

        const isActive = ev.id === activeId
        return (
          <button
            key={ev.id}
            ref={el => { if (el) itemRefs.current.set(ev.id, el); else itemRefs.current.delete(ev.id) }}
            onClick={() => onTap(ev)}
            className="flex-shrink-0 flex flex-col rounded-xl px-2.5 py-1.5 active:opacity-70 transition-all text-right"
            style={{
              backgroundColor: isActive ? color + '30' : (isPending ? '#3b82f610' : color + '18'),
              border: `2px ${isTask ? 'dashed' : 'solid'} ${isActive ? color : (isPending ? '#3b82f6' : color + '55')}`,
              minWidth: 90,
              boxShadow: isActive ? `0 0 0 2px ${color}55` : undefined,
              transform: isActive ? 'scale(1.07)' : undefined,
            }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs flex-shrink-0">{typeIcon}</span>
              <span className="text-[10px] font-black px-1 py-0.5 rounded-md flex-shrink-0"
                style={{ background: isPending ? '#3b82f620' : color + '30', color: isPending ? '#3b82f6' : color }}>
                {isPending ? tr.rsvpPending : typeLabel}
              </span>
            </div>
            <span className="text-xs font-bold max-w-[90px] truncate" style={{ color: isPending ? '#3b82f6' : color }}>
              {ev.title}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {ev.time && (
                <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{ev.time.slice(0,5)}</span>
              )}
              <span className={`text-[10px] font-black rounded-lg px-1.5 py-0.5 flex-shrink-0 ${
                hot ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {timeText}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
