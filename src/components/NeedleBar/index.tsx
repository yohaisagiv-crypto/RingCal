import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { useEffect, useReducer, useCallback, useRef } from 'react'

interface Props {
  onMenu: () => void
  onSearch: () => void
}

export default function NeedleBar({ onMenu, onSearch }: Props) {
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

  const label1 = `${tr.days[needle.getDay()]} — ${needle.getDate()} ${tr.monthsShort[needle.getMonth()]}`
  const label2 = `${needle.getDate()}/${needle.getMonth()+1} ${needle.getHours().toString().padStart(2,'0')}:${needle.getMinutes().toString().padStart(2,'0')}`

  const moveNeedle = useCallback((dir: number) => {
    const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const cur = needle.getTime()
    const go = (d: Date) => { setNeedle(d); setViewDate(d) }
    if (dir > 0) {
      const next = sorted.find(e => new Date(e.date).getTime() > cur)
      if (next) { go(new Date(next.date)); return }
      const d = new Date(needle)
      if (mode === 'day') d.setHours(d.getHours() + 1)
      else d.setDate(d.getDate() + 1)
      go(d)
    } else {
      const prev = [...sorted].reverse().find(e => new Date(e.date).getTime() < cur)
      if (prev) { go(new Date(prev.date)); return }
      const d = new Date(needle)
      if (mode === 'day') d.setHours(d.getHours() - 1)
      else d.setDate(d.getDate() - 1)
      go(d)
    }
  }, [needle, events, setNeedle, setViewDate, mode])

  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-white border-b-[3px] border-red-400">
      {/* menu */}
      <button onClick={onMenu} className="w-7 h-7 bg-gray-100 rounded-md text-gray-500 text-base flex items-center justify-center flex-shrink-0">
        ☰
      </button>

      <div className="flex-[0.3]" />

      {/* prev */}
      <button onClick={() => moveNeedle(-1)} className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center shadow flex-shrink-0 text-sm">
        ↺
      </button>

      {/* center info */}
      <div className="flex-1 flex flex-col items-center min-w-0">
        <span className="text-[11px] font-black text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          {label1}
        </span>
        <span className={`text-[9px] font-semibold font-mono ${isNow ? 'text-orange-400' : 'text-gray-400'}`}>
          {isNow ? tr.now : label2}
        </span>
        <button
          onClick={() => { try { timeInputRef.current?.showPicker?.() } catch { timeInputRef.current?.click() } }}
          className="bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded mt-0.5 relative"
        >
          {tr.pickTime}
          <input
            ref={timeInputRef}
            type="datetime-local"
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={`${needle.getFullYear()}-${String(needle.getMonth()+1).padStart(2,'0')}-${String(needle.getDate()).padStart(2,'0')}T${String(needle.getHours()).padStart(2,'0')}:${String(needle.getMinutes()).padStart(2,'0')}`}
            onChange={e => { if (e.target.value) { const d = new Date(e.target.value); setNeedle(d); setViewDate(d) } }}
          />
        </button>
      </div>

      {/* next */}
      <button onClick={() => moveNeedle(1)} className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center shadow flex-shrink-0 text-sm">
        ↻
      </button>

      <div className="flex-[0.3]" />

      {/* search */}
      <button onClick={onSearch} className="w-8 h-8 bg-blue-500 rounded-lg text-white text-base flex items-center justify-center shadow flex-shrink-0">
        🔍
      </button>
    </div>
  )
}
