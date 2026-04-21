import { useState, useRef, useCallback } from 'react'
import SpiralScreen from '../screens/SpiralScreen'
import EventsScreen from '../screens/EventsScreen'
import SettingsScreen from '../screens/SettingsScreen'

export default function AppLayout() {
  const [page, setPage] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 60) return
    if (dx < 0) setPage(p => Math.min(2, p + 1))
    else setPage(p => Math.max(0, p - 1))
    touchStartX.current = null
  }, [])

  const offset = (i: number) => {
    if (i === page) return 'translate-x-0'
    if (i < page) return 'translate-x-full'
    return '-translate-x-full'
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(0)}`}>
          <SpiralScreen onNavigate={setPage} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(1)}`}>
          <EventsScreen onBack={() => setPage(0)} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(2)}`}>
          <SettingsScreen onBack={() => setPage(0)} />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 bg-white border-t border-gray-100">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`rounded-full transition-all duration-200 ${
              page === i ? 'w-6 h-2.5 bg-blue-500' : 'w-2.5 h-2.5 bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
