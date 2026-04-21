import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { ViewMode } from '../../types'

export default function TopBar() {
  const { mode, setMode, viewDate, setViewDate, gcalConnected } = useAppStore()
  const { tr } = useLang()

  const TABS: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'year',  icon: '🌐', label: tr.year },
    { mode: 'month', icon: '🗓', label: tr.month },
    { mode: 'week',  icon: '📅', label: tr.week },
    { mode: 'day',   icon: '⏱', label: tr.day },
  ]

  const monthLabel = `${tr.months[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  const navigate = (dir: number) => {
    const d = new Date(viewDate)
    if (mode === 'year') d.setFullYear(d.getFullYear() + dir)
    else if (mode === 'month') d.setMonth(d.getMonth() + dir)
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setViewDate(d)
  }

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2 px-2 py-1">
        <button onClick={() => navigate(-1)} className="w-8 h-8 bg-gray-100 rounded-lg text-gray-500 font-bold">‹</button>
        <span className="flex-1 text-center font-mono text-sm text-gray-600">{monthLabel}</span>
        <button onClick={() => navigate(1)} className="w-8 h-8 bg-gray-100 rounded-lg text-gray-500 font-bold">›</button>
        {gcalConnected && (
          <button className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {tr.gcalConnected}
          </button>
        )}
      </div>
      <div className="flex border-t border-gray-100">
        {TABS.map(t => (
          <button
            key={t.mode}
            onClick={() => setMode(t.mode)}
            className={`flex-1 py-2 text-base font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${
              mode === t.mode
                ? 'text-blue-500 border-blue-500 bg-blue-50/60 rounded-t-xl'
                : 'text-gray-600 border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
