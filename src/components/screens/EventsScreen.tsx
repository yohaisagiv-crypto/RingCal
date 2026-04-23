import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import EventSheet from '../EventSheet'
import type { CalendarEvent } from '../../types'

export default function EventsScreen({ onBack }: { onBack: () => void }) {
  const { events, categories, deleteEvent, updateEvent } = useAppStore()
  const { tr } = useLang()
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [addNew, setAddNew] = useState(false)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [searchPast, setSearchPast] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const nonTasks = events.filter(e => e.itemType !== 'task')
  const filtered = nonTasks.filter(e =>
    (!filterCat || e.categoryId === filterCat)
  )

  const upcoming = filtered
    .filter(e => e.date >= today && !e.done)
    .sort((a, b) => (a.date + (a.time ?? '')) < (b.date + (b.time ?? '')) ? -1 : 1)
    .filter(e => !search || e.title.includes(search) || (e.note ?? '').includes(search))

  const past = filtered
    .filter(e => e.date < today || e.done)
    .sort((a, b) => (a.date + (a.time ?? '')) > (b.date + (b.time ?? '')) ? -1 : 1)
    .filter(e => !searchPast || e.title.includes(searchPast) || (e.note ?? '').includes(searchPast))

  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getDate()} ${tr.monthsShort?.[d.getMonth()] ?? ''} ${d.getFullYear()}`
  }

  const ago = (s: string) => {
    const diff = Math.round((new Date(s).getTime() - new Date(today).getTime()) / 86400000)
    if (diff === 0) return tr.today
    if (diff === 1) return tr.tomorrow
    if (diff > 0) return `${tr.inDays} ${diff}${tr.dayUnit ?? 'י'}`
    return `${tr.agoDays} ${Math.abs(diff)}${tr.dayUnit ?? 'י'}`
  }

  const EventRow = ({ ev }: { ev: CalendarEvent }) => {
    const cat = categories.find(c => c.id === ev.categoryId)
    const isPast = ev.date < today || ev.done
    return (
      <div
        key={ev.id}
        onClick={() => setEditEvent(ev)}
        className={`flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl shadow-sm border cursor-pointer active:scale-[.98] transition-transform ${isPast ? 'opacity-55' : ''}`}
        style={{ borderColor: (cat?.color ?? '#888') + '44', borderRightWidth: 3, borderRightColor: cat?.color }}
      >
        <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id) }}
          className="text-gray-300 text-lg font-black w-5 flex-shrink-0 hover:text-red-400">×</button>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
          <p className="text-[10px] text-gray-400 font-mono">{fmt(ev.date)}{ev.time ? ` · ${ev.time}` : ''} · {cat?.icon} {cat?.name}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); updateEvent(ev.id, { itemType: 'task' }) }}
          className="flex-shrink-0 px-2 py-1 rounded-lg bg-green-50 border border-green-300 text-green-700 text-[10px] font-extrabold whitespace-nowrap"
        >→ מטלה</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <button onClick={onBack} className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex-shrink-0">
          {tr.backToBoard}
        </button>
        <span className="font-mono text-base font-black text-gray-800 flex-1 text-center">📋 {tr.eventsList}</span>
        <button onClick={() => setAddNew(true)} className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          {tr.addShort}
        </button>
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

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3" dir="rtl">

        {/* Upcoming */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide flex-1">
              אירועים קרובים ({upcoming.length})
            </p>
          </div>
          {/* Search upcoming */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 חיפוש..."
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            dir="rtl"
          />
          {upcoming.length === 0
            ? <p className="text-sm text-gray-400 text-center py-3">אין אירועים קרובים</p>
            : upcoming.map(ev => <EventRow key={ev.id} ev={ev} />)
          }
        </div>

        {/* Past — collapsible */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button
            onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white font-extrabold text-sm text-gray-600"
          >
            <span>עבר ומושלמים ({past.length})</span>
            <span className="text-gray-400">{showPast ? '▲' : '▼'}</span>
          </button>
          {showPast && (
            <div className="bg-[#f5f5f7] px-2 pb-2 pt-1 flex flex-col gap-1.5">
              <input
                value={searchPast}
                onChange={e => setSearchPast(e.target.value)}
                placeholder="🔍 חיפוש בעבר..."
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-1"
                dir="rtl"
              />
              {past.length === 0
                ? <p className="text-sm text-gray-400 text-center py-3">אין אירועים</p>
                : past.map(ev => <EventRow key={ev.id} ev={ev} />)
              }
            </div>
          )}
        </div>
      </div>

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
