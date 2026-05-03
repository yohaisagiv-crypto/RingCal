import { useState } from 'react'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent } from '../../types'

interface Props {
  events: CalendarEvent[]
  onClose: () => void
  onSelect: (ev: CalendarEvent) => void
}

export default function SearchOverlay({ events, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const { tr, rtl } = useLang()
  const dir = rtl ? 'rtl' : 'ltr'

  const q = query.trim().toLowerCase()
  const results = q
    ? events.filter(e => e.title.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q))
    : []

  return (
    <>
      <div className="absolute inset-0 bg-black/40 z-40" onClick={onClose} />
      <div dir={dir} className="absolute top-0 left-0 right-0 bg-white shadow-2xl z-50 px-4 pb-4 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tr.searchPlaceholder}
            className="flex-1 bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm font-bold outline-none"
            dir={dir}
          />
          <button
            onClick={onClose}
            className="w-9 h-9 bg-gray-100 rounded-xl text-gray-500 font-black flex items-center justify-center flex-shrink-0"
          >✕</button>
        </div>
        {query.trim() && (
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
            {results.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">{tr.noResults}</p>
              : results.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-right active:bg-blue-50 transition-colors"
                >
                  <span className="text-base flex-shrink-0">{ev.itemType === 'task' ? '✅' : '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{ev.date}{ev.time ? ` · ${ev.time}` : ''}</p>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </>
  )
}
