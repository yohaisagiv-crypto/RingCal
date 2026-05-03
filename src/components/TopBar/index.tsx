import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { ViewMode } from '../../types'

export default function TopBar() {
  const { mode, setMode, viewDate, gcalConnected } = useAppStore()
  const { tr } = useLang()

  const TABS: { mode: ViewMode; label: string }[] = [
    { mode: 'year',  label: tr.year },
    { mode: 'month', label: tr.month },
    { mode: 'week',  label: tr.week },
    { mode: 'day',   label: tr.day },
  ]

  const monthLabel = `${tr.monthsShort[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-2 py-1.5 flex items-center gap-1.5">
      <div className="flex-1 flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.mode}
            onClick={() => setMode(t.mode)}
            className={`flex-1 py-2.5 text-base font-extrabold rounded-lg transition-all ${
              mode === t.mode
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">{monthLabel}</span>

      {gcalConnected && (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full text-[9px] font-bold border border-green-200 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />G
        </span>
      )}
    </div>
  )
}
