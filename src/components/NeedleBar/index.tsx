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

  const label1 = `${tr.days[needle.getDay()]} — ${needle.getDate()} ${tr.months[needle.getMonth()]}`
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
    <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-white border-b-4 border-red-400">
      <button onClick={onMenu} className="w-8 h-8 bg-gray-100 rounded-lg text-gray-500 text-lg flex items-center justify-center flex-shrink-0">
        ☰
      </button>
      <div className="flex-[0.4]" />
      <button onClick={() => moveNeedle(-1)} className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-md flex-shrink-0 text-base">
        ↺
      </button>
      <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
        <span className="text-xs font-black text-[#1a1a2e] whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          {label1}
        </span>
        <span className={`text-[10px] font-bold font-mono ${isNow ? 'text-orange-400' : 'text-gray-500'}`}>
          {isNow ? tr.now : label2}
        </span>
        <button onClick={() => { try { timeInputRef.current?.showPicker?.() } catch { timeInputRef.current?.click() } }}
          className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 relative">
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
      <button onClick={() => moveNeedle(1)} className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-md flex-shrink-0 text-base">
        ↻
      </button>
      <div className="flex-[0.4]" />
      <button onClick={onSearch} className="w-10 h-10 bg-blue-500 rounded-xl text-white text-xl flex items-center justify-center shadow-md flex-shrink-0">
        🔍
      </button>
    </div>
  )
}
