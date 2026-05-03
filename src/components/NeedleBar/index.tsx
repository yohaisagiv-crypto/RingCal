import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { useEffect, useReducer, useCallback, useRef } from 'react'

interface Props {
  onSearch: () => void
}

export default function NeedleBar({ onSearch }: Props) {
  const { needle, setNeedle, setViewDate, events, mode } = useAppStore()
  const { tr } = useLang()
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  const timeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(forceUpdate, 60000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const isNow = Math.abs(needle.getTime() - now.getTime()) < 120000

  const dateLabel = `${tr.days[needle.getDay()]} ${needle.getDate()} ${tr.monthsShort[needle.getMonth()]}`
  const timeLabel = `${needle.getHours().toString().padStart(2,'0')}:${needle.getMinutes().toString().padStart(2,'0')}`

  const moveNeedle = useCallback((dir: number) => {
    const evMs = (e: { date: string; time?: string }) =>
      new Date(e.date + 'T' + (e.time ?? '00:00') + ':00').getTime()
    const sorted = [...events].filter(e => !e.done).sort((a, b) => evMs(a) - evMs(b))
    const cur = needle.getTime()
    const go = (d: Date) => { setNeedle(d); setViewDate(d) }
    if (dir > 0) {
      const next = sorted.find(e => evMs(e) > cur)
      if (next) { go(new Date(next.date + 'T' + (next.time ?? '00:00') + ':00')); return }
      const d = new Date(needle)
      if (mode === 'day') d.setHours(d.getHours() + 1)
      else d.setDate(d.getDate() + 1)
      go(d)
    } else {
      const prev = [...sorted].reverse().find(e => evMs(e) < cur)
      if (prev) { go(new Date(prev.date + 'T' + (prev.time ?? '00:00') + ':00')); return }
      const d = new Date(needle)
      if (mode === 'day') d.setHours(d.getHours() - 1)
      else d.setDate(d.getDate() - 1)
      go(d)
    }
  }, [needle, events, setNeedle, setViewDate, mode])

  return (
    <div className="flex-shrink-0 flex items-center px-2 py-1.5 bg-white border-b-2 border-red-400" style={{ gap: 0 }}>
      {/* Prev event */}
      <button
        onClick={() => moveNeedle(-1)}
        className="flex items-center gap-0.5 h-9 px-2.5 rounded-full bg-red-500 text-white flex-shrink-0 text-sm font-bold shadow"
      >
        <span className="text-base leading-none">←</span>
        <span className="text-[10px] font-black leading-none hidden xs:block">{tr.prevShort}</span>
      </button>

      {/* Center info + pick time */}
      <button
        className="flex-1 flex flex-col items-center justify-center min-w-0 mx-1 relative py-1"
        onClick={() => { try { timeInputRef.current?.showPicker?.() } catch { timeInputRef.current?.click() } }}
      >
        <span className={`text-sm font-black truncate max-w-full ${isNow ? 'text-red-500' : 'text-gray-800'}`}>
          {isNow ? `🔴 ${tr.now}` : dateLabel}
        </span>
        <span className="text-xs font-mono text-gray-400">{timeLabel} · {tr.pickTime}</span>
        <input
          ref={timeInputRef}
          type="datetime-local"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          value={`${needle.getFullYear()}-${String(needle.getMonth()+1).padStart(2,'0')}-${String(needle.getDate()).padStart(2,'0')}T${String(needle.getHours()).padStart(2,'0')}:${String(needle.getMinutes()).padStart(2,'0')}`}
          onChange={e => { if (e.target.value) { const d = new Date(e.target.value); setNeedle(d); setViewDate(d) } }}
        />
      </button>

      {/* Next event */}
      <button
        onClick={() => moveNeedle(1)}
        className="flex items-center gap-0.5 h-9 px-2.5 rounded-full bg-red-500 text-white flex-shrink-0 text-sm font-bold shadow"
      >
        <span className="text-[10px] font-black leading-none hidden xs:block">{tr.nextShort}</span>
        <span className="text-base leading-none">→</span>
      </button>

      <div className="w-6 flex-shrink-0" />

      {/* Today reset */}
      {!isNow && (
        <button
          onClick={() => { const n = new Date(); setNeedle(n); setViewDate(n) }}
          className="w-9 h-9 rounded-lg bg-red-50 border border-red-300 text-red-500 flex items-center justify-center flex-shrink-0 text-[10px] font-black leading-tight"
        >{tr.today}</button>
      )}

      {/* Search — separated from red buttons */}
      <button
        onClick={onSearch}
        className="w-9 h-9 rounded-lg bg-blue-500 text-white flex items-center justify-center flex-shrink-0 text-lg"
      >🔍</button>
    </div>
  )
}
