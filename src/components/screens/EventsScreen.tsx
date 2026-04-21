import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import EventSheet from '../EventSheet'
import type { CalendarEvent } from '../../types'

export default function EventsScreen({ onBack }: { onBack: () => void }) {
  const { events, categories, deleteEvent } = useAppStore()
  const { tr } = useLang()
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [addNew, setAddNew] = useState(false)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const now = new Date()

  const sorted = [...events]
    .filter(e => !filterCat || e.categoryId === filterCat)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getDate()} ${tr.monthsShort[d.getMonth()]}`
  }

  const ago = (s: string) => {
    const diff = Math.round((new Date(s).getTime() - now.getTime()) / 86400000)
    if (diff === 0) return tr.today
    if (diff === 1) return tr.tomorrow
    if (diff > 0) return `${tr.inDays} ${diff}${tr.dayUnit}`
    return `${tr.agoDays} ${Math.abs(diff)}${tr.dayUnit}`
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <button onClick={onBack} className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex-shrink-0">
          {tr.backToBoard}
        </button>
        <span className="font-mono text-lg font-black text-gray-800 flex-1 text-center">📋 {tr.eventsList}</span>
        <button onClick={() => setAddNew(true)} className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          {tr.addShort}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b border-gray-100 scrollbar-none">
        <button
          onClick={() => setFilterCat(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 ${!filterCat ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
        >{tr.all}</button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 transition-all"
            style={{
              borderColor: cat.color,
              background: filterCat === cat.id ? cat.color : cat.color + '22',
              color: filterCat === cat.id ? '#fff' : cat.color,
            }}
          >{cat.icon} {cat.name}</button>
        ))}
      </div>

      {/* Category legend */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2">{tr.categories}</p>
        <div className="flex flex-col gap-1.5">
          {categories.map((cat, i) => (
            <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: cat.color + '18', border: `1.5px solid ${cat.color}44` }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm font-bold" style={{ color: cat.color }}>{cat.name}</span>
              </div>
              <span className="text-xs font-mono text-gray-400">{tr.ring} {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="flex-shrink-0 text-xs font-black text-gray-600 uppercase tracking-widest px-4 py-2 border-b border-gray-100 bg-[#f5f5f7]">{tr.eventsSection}</p>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
        {sorted.length === 0
          ? <p className="text-center text-gray-400 font-mono text-sm mt-10">{tr.noEvents}</p>
          : sorted.map(ev => {
              const cat = categories.find(c => c.id === ev.categoryId)
              const isPast = new Date(ev.date) < now
              return (
                <div key={ev.id}
                  onClick={() => setEditEvent(ev)}
                  className={`flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm border cursor-pointer active:scale-[.98] transition-transform ${isPast ? 'opacity-60' : ''}`}
                  style={{ borderColor: cat?.color + '44' ?? '#eee', borderRightWidth: 3, borderRightColor: cat?.color }}
                >
                  <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id) }}
                    className="text-gray-300 text-lg font-black w-5 flex-shrink-0 hover:text-red-400">×</button>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{fmt(ev.date)}{ev.time ? ` · ${ev.time}` : ''}</p>
                    {cat && <p className="text-[10px] text-gray-400">{cat.icon} {cat.name}</p>}
                  </div>
                  <span className="text-[10px] font-bold font-mono flex-shrink-0"
                    style={{ color: isPast ? '#aaa' : cat?.color }}>{ago(ev.date)}</span>
                </div>
              )
            })}
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
