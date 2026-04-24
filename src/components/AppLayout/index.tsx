import { useState, useRef, useCallback, useEffect } from 'react'

function RingCalIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 40 40" className="mb-0.5">
      <circle cx="20" cy="20" r="17" fill="none" stroke={active ? '#93c5fd' : '#d1d5db'} strokeWidth="2.5" />
      <circle cx="20" cy="20" r="12" fill="none" stroke={active ? '#a5b4fc' : '#d1d5db'} strokeWidth="2.5" />
      <circle cx="20" cy="20" r="7"  fill="none" stroke={active ? '#c4b5fd' : '#d1d5db'} strokeWidth="2.5" />
      <circle cx="20" cy="20" r="2.5" fill={active ? '#fff' : '#9ca3af'} />
      {/* needle */}
      <line x1="20" y1="20" x2="20" y2="3" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
import SpiralScreen from '../screens/SpiralScreen'
import EventsScreen from '../screens/EventsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import TasksScreen from '../screens/TasksScreen'
import AIScreen from '../screens/AIScreen'
import { useAppStore } from '../../store/useAppStore'

export default function AppLayout() {
  const [page, setPage] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const { bumpSpiralGeneration } = useAppStore()

  useEffect(() => {
    let handler: { remove: () => void } | null = null
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('backButton', () => {
          if (page === 0) App.exitApp()
          else navigateTo(0)
        }).then(h => { handler = h })
      })
    }
    return () => { handler?.remove() }
  }, [page])

  const navigateTo = useCallback((p: number) => {
    setPage(p)
    if (p === 0) bumpSpiralGeneration()
  }, [bumpSpiralGeneration])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 60) return
    const next = dx < 0 ? Math.min(4, page + 1) : Math.max(0, page - 1)
    navigateTo(next)
    touchStartX.current = null
  }, [page, navigateTo])

  const offset = (i: number) => {
    if (i === page) return 'translate-x-0'
    if (i < page) return 'translate-x-full'
    return '-translate-x-full'
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(0)}`}>
          <SpiralScreen onNavigate={navigateTo} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(1)}`}>
          <EventsScreen onBack={() => navigateTo(0)} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(2)}`}>
          <TasksScreen onBack={() => navigateTo(0)} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(3)}`}>
          <AIScreen onBack={() => navigateTo(0)} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(4)}`}>
          <SettingsScreen onBack={() => navigateTo(0)} />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-2 bg-white border-t border-gray-200">
        {[
          { icon: null, label: 'יומן' },
          { icon: '📋', label: 'אירועים' },
          { icon: '✅', label: 'מטלות' },
          { icon: '🤖', label: 'AI' },
          { icon: '⚙️', label: 'הגדרות' },
        ].map((tab, i) => (
          <button
            key={i}
            onClick={() => navigateTo(i)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl font-extrabold text-[11px] transition-all duration-200 ${
              page === i
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i === 0 ? (
              <RingCalIcon active={page === 0} />
            ) : (
              <span className="text-base leading-none mb-0.5">{tab.icon}</span>
            )}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
