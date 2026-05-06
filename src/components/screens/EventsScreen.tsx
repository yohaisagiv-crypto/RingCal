import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { localISODate } from '../../hooks/useSpiralMath'
import EventSheet from '../EventSheet'
import YearMonthFilter from '../YearMonthFilter'
import type { CalendarEvent, Category } from '../../types'
import * as gcal from '../../services/googleCalendar'

function timeRemaining(
  date: string,
  time: string | undefined,
  tr: { today: string; tomorrow: string; timeLeftHours: string; timeLeftDays: string; timeLeftWeeks: string; timeLeftMonths: string }
): { text: string; hot: boolean } | null {
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const evMs = new Date(date + 'T00:00:00').getTime()
  const diffDays = Math.round((evMs - todayMs) / 86_400_000)
  if (diffDays < 0) return null
  if (diffDays === 0) {
    if (time?.trim()) {
      const mins = Math.round((new Date(date + `T${time}:00`).getTime() - Date.now()) / 60_000)
      if (mins <= 0) return { text: tr.today, hot: true }
      if (mins < 60) return { text: `${mins}′`, hot: true }
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return { text: m > 0 ? `${h}${tr.timeLeftHours} ${m}′` : `${h}${tr.timeLeftHours}`, hot: true }
    }
    return { text: tr.today, hot: true }
  }
  if (diffDays === 1) return { text: tr.tomorrow, hot: true }
  if (diffDays <= 7) return { text: `${diffDays}${tr.timeLeftDays}`, hot: diffDays <= 2 }
  if (diffDays <= 30) return { text: `${Math.floor(diffDays / 7)}${tr.timeLeftWeeks}`, hot: false }
  return { text: `${Math.floor(diffDays / 30)}${tr.timeLeftMonths}`, hot: false }
}

interface EventRowProps {
  ev: CalendarEvent
  categories: Category[]
  today: string
  tr: ReturnType<typeof import('../../i18n/translations').getLang>
  onEdit: (ev: CalendarEvent) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}

function EventRow({ ev, categories, today, tr, onEdit, selected, onToggleSelect }: EventRowProps) {
  const cat = categories.find(c => c.id === ev.categoryId)
  const isPast = ev.date < today || ev.done
  const isPending = ev.rsvpStatus === 'pending'
  const timeLeft = isPast ? null : timeRemaining(ev.date, ev.time, tr)
  return (
    <div
      onClick={() => onEdit(ev)}
      className={`flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl shadow-sm border cursor-pointer active:scale-[.98] transition-transform ${isPast ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{ borderColor: (cat?.color ?? '#888') + '44', borderRightWidth: 3, borderRightColor: cat?.color }}
    >
      <span
        onClick={e => { e.stopPropagation(); onToggleSelect(ev.id) }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs font-black transition-colors cursor-pointer ${selected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-transparent hover:border-blue-300'}`}
      >✓</span>
      <span className="text-sm flex-shrink-0">{isPending ? '📬' : '📅'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">
          {isPending && <span className="text-blue-500 text-[10px] font-black mr-1 bg-blue-50 px-1 rounded">{tr.rsvpPending}</span>}
          {ev.title}
        </p>
        <p className="text-[10px] text-gray-400 font-mono">
          {ev.date.slice(5).replace('-', '/')} {ev.time ? `· ${ev.time}` : ''} · {cat?.icon} {cat?.name}
          {ev.gcalId && <span className="inline-block ml-1 text-[9px] font-black bg-blue-100 text-blue-500 px-1 rounded leading-tight">G</span>}
        </p>
      </div>
      {timeLeft && (
        <span className={`text-[11px] font-black rounded-md px-1.5 py-0.5 leading-none flex-shrink-0 ${timeLeft.hot ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {timeLeft.text}
        </span>
      )}
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
    </div>
  )
}

export default function EventsScreen({ onBack }: { onBack: () => void }) {
  const { events, categories, deleteEvent, gcalConnected, addEvent, patchEventGcalId, deletedGcalIds } = useAppStore()
  const { tr, rtl } = useLang()

  const handleDelete = (id: string) => {
    const ev = events.find(e => e.id === id)
    if (ev?.gcalId && gcalConnected && gcal.isConnected()) {
      gcal.deleteEvent(ev.gcalId).catch(() => {})
    }
    deleteEvent(id)
  }
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalLoadDone, setGcalLoadDone] = useState(false)
  const [addNew, setAddNew] = useState(false)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [searchPast, setSearchPast] = useState('')
  const [gcalYears, setGcalYears] = useState<1 | 3 | 10 | 20>(20)
  const [gcalCustomFrom, setGcalCustomFrom] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [showGcalImport, setShowGcalImport] = useState(false)
  const [historyYear, setHistoryYear] = useState<number | null>(null)
  const [historyMonth, setHistoryMonth] = useState<number | null>(null)
  const [gcalOnly, setGcalOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHistoryYear(null); setHistoryMonth(null); setGcalOnly(false) }, [filterCat])

  const today = localISODate()

  const nonTasks = events.filter(e => e.itemType !== 'task')
  const filtered = nonTasks.filter(e => (!filterCat || e.categoryId === filterCat))

  const searchLower = search.toLowerCase()
  const searchPastLower = searchPast.toLowerCase()

  const overdue = filtered
    .filter(e => e.date < today && !e.done && e.itemType !== 'task')
    .filter(e => !searchLower || e.title.toLowerCase().includes(searchLower) || (e.note ?? '').toLowerCase().includes(searchLower))
    .sort((a, b) => (a.date + (a.time ?? '')) > (b.date + (b.time ?? '')) ? -1 : 1)

  const upcomingAll = filtered
    .filter(e => e.date >= today && !e.done)
    .sort((a, b) => (a.date + (a.time ?? '')) < (b.date + (b.time ?? '')) ? -1 : 1)
    .filter(e => !searchLower || e.title.toLowerCase().includes(searchLower) || (e.note ?? '').toLowerCase().includes(searchLower))

  const pendingInvites = upcomingAll.filter(e => e.rsvpStatus === 'pending')
  const upcoming = upcomingAll.filter(e => e.rsvpStatus !== 'pending')

  const allPast = filtered.filter(e => (e.date < today || e.done) && (!gcalOnly || !!e.gcalId))
  const pastYears = [...new Set(allPast.map(e => parseInt(e.date?.slice(0, 4) ?? '0')).filter(y => y > 2000))].sort((a, b) => b - a).slice(0, 8)

  const past = allPast
    .filter(e => {
      if (historyYear === null) return true
      const y = parseInt(e.date?.slice(0, 4) ?? '0')
      if (y !== historyYear) return false
      if (historyMonth === null) return true
      const m = parseInt(e.date?.slice(5, 7) ?? '0')
      return m === historyMonth
    })
    .sort((a, b) => (a.date + (a.time ?? '')) > (b.date + (b.time ?? '')) ? -1 : 1)
    .filter(e => !searchPastLower || e.title.toLowerCase().includes(searchPastLower) || (e.note ?? '').toLowerCase().includes(searchPastLower))

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deleteSelected = () => {
    for (const id of selectedIds) handleDelete(id)
    setSelectedIds(new Set())
  }

  const loadHistoricalFromGcal = async () => {
    if (!gcalConnected || !gcal.isConnected()) return
    setGcalLoading(true)
    try {
      const since = useCustomDate && gcalCustomFrom
        ? new Date(gcalCustomFrom + 'T00:00:00')
        : new Date(new Date().getFullYear() - gcalYears, 0, 1)
      const gcalEvents = await gcal.fetchFutureEvents(since)
      const state = useAppStore.getState()
      const existingIds = new Set(state.events.map(e => e.gcalId).filter(Boolean))
      const deletedIds = new Set(state.deletedGcalIds)
      const cat0 = state.categories[0]?.id ?? ''
      for (const ge of gcalEvents) {
        if (existingIds.has(ge.id) || deletedIds.has(ge.id)) continue
        const imported = gcal.fromGcalEvent(ge)
        const newId = addEvent({ ...imported, itemType: 'event', categoryId: cat0, priority: 'N', done: false, links: [], files: [] })
        patchEventGcalId(newId, ge.id)
      }
      setGcalLoadDone(true)
    } catch { /* silent */ }
    setGcalLoading(false)
  }

  const rowProps = { categories, today, tr, onEdit: setEditEvent, onToggleSelect: toggleSelect }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <button onClick={onBack} className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex-shrink-0">
          ← {tr.backToBoard}
        </button>
        <span className="font-mono text-base font-black text-gray-800 flex-1 text-center">
          📋 {tr.eventsList}
          {pendingInvites.length > 0 && (
            <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-black">{pendingInvites.length}</span>
          )}
        </span>
        {selectedIds.size > 0 && (
          <>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold px-2 py-1.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
              {tr.cancel}
            </button>
            <button
              onClick={deleteSelected}
              className="bg-red-500 text-white text-sm font-extrabold px-3 py-1.5 rounded-full flex-shrink-0"
            >
              {tr.delete} ({selectedIds.size})
            </button>
          </>
        )}
        {selectedIds.size === 0 && (
          <>
            <button
              onClick={() => setShowGcalImport(true)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 border relative ${gcalConnected ? 'bg-blue-50 text-blue-500 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
              title={tr.loadGcalHistory}
            >
              📥
              {gcalLoadDone && <span className="absolute -top-1 -right-1 text-[9px] text-green-500 font-black leading-none">✓</span>}
            </button>
            <button onClick={() => setAddNew(true)} className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0">
              {tr.addShort}
            </button>
          </>
        )}
      </div>

      {/* Category filter */}
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b border-gray-100"
        style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setFilterCat(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 ${!filterCat ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
          {tr.all}
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 transition-all"
            style={{
              borderColor: cat.color,
              background: filterCat === cat.id ? cat.color : cat.color + '22',
              color: filterCat === cat.id ? '#fff' : cat.color,
            }}>
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3" dir={rtl ? 'rtl' : 'ltr'}>

        {/* Pending invites — always on top */}
        {pendingInvites.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-extrabold text-blue-600 uppercase tracking-wide flex items-center gap-1">
              <span>📬</span> {tr.rsvpPending} ({pendingInvites.length})
            </p>
            {pendingInvites.map(ev => (
              <EventRow key={ev.id} ev={ev} selected={selectedIds.has(ev.id)} {...rowProps} />
            ))}
          </div>
        )}

        {/* Overdue — not done but date passed */}
        {overdue.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-extrabold text-red-500 uppercase tracking-wide flex items-center gap-1">
              <span>⚠️</span> {tr.statsOverdue} ({overdue.length})
            </p>
            {overdue.map(ev => <EventRow key={ev.id} ev={ev} selected={selectedIds.has(ev.id)} {...rowProps} />)}
          </div>
        )}

        {/* Upcoming */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
            {tr.upcomingEventsLabel} ({upcoming.length})
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr.searchPh}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            dir={rtl ? 'rtl' : 'ltr'}
          />
          {upcoming.length === 0
            ? <p className="text-sm text-gray-400 text-center py-3">{tr.noUpcomingEvents}</p>
            : upcoming.map(ev => <EventRow key={ev.id} ev={ev} selected={selectedIds.has(ev.id)} {...rowProps} />)
          }
        </div>

        {/* Past — collapsible with date filter */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button
            onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white font-extrabold text-sm text-gray-600"
          >
            <div className="flex items-center gap-2">
              {showPast && (
                <button
                  onClick={e => { e.stopPropagation(); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-500 border-blue-200"
                >↑ {tr.upcomingEventsLabel}</button>
              )}
              <span>
                {tr.pastCompletedLabel}
                <span className="font-normal text-gray-400 text-xs ml-1">
                  ({historyYear || gcalOnly ? past.length + '/' + filtered.filter(e => e.date < today || e.done).length : past.length})
                </span>
              </span>
              <button
                onClick={e => { e.stopPropagation(); setGcalOnly(v => !v); setHistoryYear(null); setHistoryMonth(null) }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${gcalOnly ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-300'}`}
              >📅 G</button>
            </div>
            <span className="text-gray-400">{showPast ? '▲' : '▼'}</span>
          </button>
          {showPast && (
            <div className="bg-[#f5f5f7] px-2 pb-2 pt-2 flex flex-col gap-1.5 max-h-[65vh] overflow-y-auto">
              <YearMonthFilter
                year={historyYear} month={historyMonth} years={pastYears}
                onYear={setHistoryYear} onMonth={setHistoryMonth}
                allLabel={tr.all} monthsShort={tr.monthsShort}
              />
              <input
                value={searchPast}
                onChange={e => setSearchPast(e.target.value)}
                placeholder={tr.searchPastPh}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                dir={rtl ? 'rtl' : 'ltr'}
              />
              {past.length === 0
                ? <p className="text-sm text-gray-400 text-center py-3">{tr.noEvents}</p>
                : past.map(ev => <EventRow key={ev.id} ev={ev} selected={selectedIds.has(ev.id)} {...rowProps} />)
              }
              {past.length > 3 && (
                <button
                  onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-full py-2 text-xs font-bold text-blue-500 bg-blue-50 rounded-xl border border-blue-100 mt-1"
                >↑ {tr.upcomingEventsLabel}</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GCal import bottom sheet */}
      {showGcalImport && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setShowGcalImport(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 pb-8 pt-3 shadow-2xl" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
            <p className="font-extrabold text-base text-gray-800 mb-4">📥 {tr.loadGcalHistory}</p>
            {!gcalConnected && (
              <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-bold">
                ⚠️ {tr.gcalNotConnected} — {tr.goToSettings}
              </div>
            )}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{tr.gcalHistoryRange}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([1, 3, 10, 20] as const).map(y => (
                <button key={y}
                  onClick={() => { setGcalYears(y); setUseCustomDate(false) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!useCustomDate && gcalYears === y ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-blue-500 border-blue-200'}`}>
                  {y === 1 ? tr.gcalRange1y : y === 3 ? tr.gcalRange3y : y === 10 ? tr.gcalRange10y : tr.gcalRange20y}
                </button>
              ))}
              <button
                onClick={() => setUseCustomDate(v => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${useCustomDate ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-blue-500 border-blue-200'}`}>
                {tr.gcalRangeCustom}
              </button>
            </div>
            {useCustomDate && (
              <input type="date" value={gcalCustomFrom} onChange={e => setGcalCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 mb-3 text-sm outline-none bg-gray-50" dir="ltr" />
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowGcalImport(false)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600 text-sm">{tr.cancel}</button>
              <button
                onClick={async () => { await loadHistoricalFromGcal(); setShowGcalImport(false) }}
                disabled={gcalLoading || (useCustomDate && !gcalCustomFrom)}
                className={`flex-[2] py-3 rounded-xl font-extrabold text-sm disabled:opacity-50 ${gcalLoading ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white'}`}>
                {gcalLoading ? '⏳ ...' : `📅 ${tr.loadGcalHistory}`}
              </button>
            </div>
          </div>
        </>
      )}

      {(editEvent || addNew) && (
        <EventSheet
          event={editEvent}
          defaultDate={new Date()}
          onClose={() => { setEditEvent(null); setAddNew(false) }}
        />
      )}
    </div>
  )
}
