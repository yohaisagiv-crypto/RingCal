import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'

function isoDate(d?: Date): string {
  const dt = d ?? new Date()
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function StatsScreen({ onBack }: { onBack: () => void }) {
  const { events, categories } = useAppStore()
  const { tr, rtl } = useLang()

  const today = isoDate()
  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return isoDate(d)
  })()
  const monthStart = today.slice(0, 7) + '-01'

  const stats = useMemo(() => {
    const total = events.length
    const done = events.filter(e => e.done).length
    const pending = events.filter(e => !e.done && e.date >= today).length
    const overdue = events.filter(e => !e.done && e.date < today).length
    const thisWeek = events.filter(e => e.date >= weekStart && e.date <= today).length
    const thisMonth = events.filter(e => e.date >= monthStart && e.date <= today).length

    const byCat = categories.map(cat => {
      const catEvents = events.filter(e => e.categoryId === cat.id)
      return {
        cat,
        total: catEvents.length,
        done: catEvents.filter(e => e.done).length,
      }
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

    const byPriority = {
      U: events.filter(e => e.priority === 'U' && !e.done).length,
      H: events.filter(e => e.priority === 'H' && !e.done).length,
      N: events.filter(e => e.priority === 'N' && !e.done).length,
      L: events.filter(e => e.priority === 'L' && !e.done).length,
    }

    return { total, done, pending, overdue, thisWeek, thisMonth, byCat, byPriority }
  }, [events, categories, today, weekStart, monthStart])

  const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <button onClick={onBack} className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex-shrink-0">
          ← {tr.backToBoard}
        </button>
        <span className="font-mono text-lg font-black text-gray-800 flex-1 text-center">{tr.statsTitle}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={stats.total} label={tr.statsTotal} color="blue" />
          <StatCard value={`${completionRate}%`} label={tr.statsDone} color="green" />
          <StatCard value={stats.overdue} label={tr.statsOverdue} color="red" />
          <StatCard value={stats.pending} label={tr.statsPending} color="orange" />
        </div>

        {/* Period stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">📅 {tr.statsThisWeek} / {tr.statsThisMonth}</p>
          <div className="flex gap-4">
            <div className="flex-1 text-center">
              <p className="text-3xl font-black text-blue-500">{stats.thisWeek}</p>
              <p className="text-xs text-gray-500 mt-1">{tr.statsThisWeek}</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex-1 text-center">
              <p className="text-3xl font-black text-purple-500">{stats.thisMonth}</p>
              <p className="text-xs text-gray-500 mt-1">{tr.statsThisMonth}</p>
            </div>
          </div>
        </div>

        {/* Completion bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-gray-700">{tr.statsDone}</p>
            <p className="text-sm font-black text-green-600">{completionRate}%</p>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-[10px] text-gray-400">{stats.done} {tr.statsDone.toLowerCase()}</p>
            <p className="text-[10px] text-gray-400">{stats.total} {tr.statsTotal.toLowerCase()}</p>
          </div>
        </div>

        {/* Active priority breakdown */}
        {(stats.byPriority.U + stats.byPriority.H + stats.byPriority.N + stats.byPriority.L) > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">⚡ {tr.priority} ({tr.statsPending})</p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'U', label: tr.urgent, color: '#dc2626' },
                { key: 'H', label: tr.high,   color: '#f97316' },
                { key: 'N', label: tr.normal,  color: '#3b82f6' },
                { key: 'L', label: tr.low,     color: '#6b7280' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="text-center p-2 rounded-xl" style={{ background: color + '14' }}>
                  <p className="text-xl font-black" style={{ color }}>{stats.byPriority[key]}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By category */}
        {stats.byCat.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-2">{tr.statsByCategory}</p>
            {stats.byCat.map(({ cat, total, done }) => {
              const pct = total > 0 ? (done / total) * 100 : 0
              return (
                <div key={cat.id} className="px-4 py-2.5 border-t border-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="flex-1 text-sm font-bold text-gray-800 truncate">{cat.name}</span>
                    <span className="text-xs font-mono text-gray-500">{done}/{total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({ value, label, color }: { value: number | string; label: string; color: 'blue' | 'green' | 'red' | 'orange' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600'  },
    green:  { bg: 'bg-green-50',  text: 'text-green-600' },
    red:    { bg: 'bg-red-50',    text: 'text-red-600'   },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600'},
  }
  const c = colors[color]
  return (
    <div className={`${c.bg} rounded-2xl p-4 flex flex-col items-center justify-center`}>
      <p className={`text-3xl font-black ${c.text}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 text-center">{label}</p>
    </div>
  )
}
