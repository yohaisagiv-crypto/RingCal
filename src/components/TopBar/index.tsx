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
    <div className="flex-shrink-0 bg-white border-b border-gray-200">
      {/* nav row */}
      <div className="flex items-center px-2 py-1 gap-1">
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
      <div className="flex bg-gray-200 mx-2 mb-2 rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t.mode}
            onClick={() => setMode(t.mode)}
            className={`flex-1 py-2 text-sm font-extrabold rounded-lg transition-all ${
              mode === t.mode
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
