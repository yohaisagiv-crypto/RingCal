import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { ViewMode } from '../../types'

export default function TopBar() {
  const { mode, setMode, viewDate, setViewDate, gcalConnected } = useAppStore()
  const { tr } = useLang()

  const TABS: { mode: ViewMode; label: string }[] = [
    { mode: 'year',  label: tr.year },
    { mode: 'month', label: tr.month },
    { mode: 'week',  label: tr.week },
    { mode: 'day',   label: tr.day },
  ]

  const monthLabel = `${tr.monthsShort[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  const navigate = (dir: number) => {
    const d = new Date(viewDate)
    if (mode === 'year') d.setFullYear(d.getFullYear() + dir)
    else if (mode === 'month') d.setMonth(d.getMonth() + dir)
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setViewDate(d)
  }

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-150">
      {/* nav row */}
      <div className="flex items-center px-2 py-0.5 gap-1">
        <button onClick={() => navigate(-1)} className="w-7 h-7 bg-gray-100 rounded-md text-gray-500 font-bold text-sm flex items-center justify-center">‹</button>
        <span className="flex-1 text-center font-semibold text-xs text-gray-500 tracking-wide">{monthLabel}</span>
        <button onClick={() => navigate(1)} className="w-7 h-7 bg-gray-100 rounded-md text-gray-500 font-bold text-sm flex items-center justify-center">›</button>
        {gcalConnected && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[9px] font-bold border border-green-200 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Google
          </span>
        )}
      </div>
      {/* tabs row */}
      <div className="flex border-t border-gray-100">
        {TABS.map(t => (
          <button
            key={t.mode}
            onClick={() => setMode(t.mode)}
            className={`flex-1 py-1 text-[11px] font-bold tracking-wide transition-all border-b-2 ${
              mode === t.mode
                ? 'text-blue-500 border-blue-500 bg-blue-50/50'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
