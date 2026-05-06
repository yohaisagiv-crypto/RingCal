import { useState, useEffect, useRef } from 'react'
import TopBar from '../TopBar'
import NeedleBar from '../NeedleBar'
import CategoryStrip from '../CategoryStrip'
import SpiralCanvas from '../SpiralCanvas'
import EventSheet from '../EventSheet'
import UpcomingStrip from '../UpcomingStrip'
import SearchOverlay from '../SearchOverlay'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent } from '../../types'
import * as gcal from '../../services/googleCalendar'

interface Props {
  onNavigate: (page: number) => void
  filterCats?: string[]
  filterType?: 'all' | 'event' | 'task'
}

export default function SpiralScreen({ onNavigate, filterCats = [], filterType = 'all' }: Props) {
  const [sheetEvent, setSheetEvent] = useState<CalendarEvent | null>(null)
  const [addDate, setAddDate] = useState<Date | null>(null)
  const [addType, setAddType] = useState<'event' | 'task'>('event')
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const { events, gcalConnected, needle, spiralGeneration, soloCategory } = useAppStore()
  const filteredEventsOverride = (filterCats.length > 0 || filterType !== 'all' || filterCat)
    ? events
        .filter(e => filterCats.length === 0 || filterCats.includes(e.categoryId))
        .filter(e => filterType === 'all' || e.itemType === filterType)
        .filter(e => !filterCat || e.categoryId === filterCat)
    : undefined
  const { tr } = useLang()
  const pendingCount = events.filter(e => e.rsvpStatus === 'pending').length

  const closeSheet = () => { setSheetEvent(null); setAddDate(null) }

  const handleFilterCat = (catId: string | null) => {
    setFilterCat(catId)
    soloCategory(catId)
  }

  const prevGenRef = useRef(spiralGeneration)
  useEffect(() => {
    if (prevGenRef.current !== spiralGeneration) {
      prevGenRef.current = spiralGeneration
      closeSheet()
      setShowFabMenu(false)
      setShowSearch(false)
    }
  }, [spiralGeneration])

  useEffect(() => {
    let lastPullTs = 0
    const pull = async () => {
      if (!gcalConnected || !gcal.isConnected()) return
      const now = Date.now()
      if (now - lastPullTs < 5 * 60_000) return  // throttle: max once per 5 min
      lastPullTs = now
      try {
        // Only fetch 30 days back + future — historical import is done via EventsScreen
        const since = new Date(now - 30 * 86_400_000)
        const gcalEvents = await gcal.fetchFutureEvents(since)
        const existingIds = new Set(useAppStore.getState().events.map(e => e.gcalId).filter(Boolean))
        const deletedSet = new Set(useAppStore.getState().deletedGcalIds)
        for (const ge of gcalEvents) {
          if (existingIds.has(ge.id)) continue
          if (deletedSet.has(ge.id)) continue
          const imported = gcal.fromGcalEvent(ge)
          const cat = useAppStore.getState().categories[0]?.id ?? ''
          const newId = useAppStore.getState().addEvent({ ...imported, itemType: 'event', categoryId: cat, priority: 'N', done: false, links: [], files: [] })
          useAppStore.getState().patchEventGcalId(newId, ge.id)
        }
      } catch { /* silent */ }
    }
    pull()
    const onVisible = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gcalConnected])

  return (
    <div className="flex flex-col h-full relative bg-[#f5f5f7]">
      <TopBar />
      <NeedleBar onSearch={() => setShowSearch(true)} />
      {pendingCount > 0 && (
        <button
          onClick={() => onNavigate(1)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-bold active:bg-blue-700 transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{pendingCount}</span>
          <span className="flex-1 text-right">{tr.pendingNotice}</span>
          <span className="text-white/70 text-base">›</span>
        </button>
      )}
      <CategoryStrip onParams={() => onNavigate(5)} filterCat={filterCat} onFilter={handleFilterCat} />
      <div className="lg:hidden">
        <UpcomingStrip onTap={(ev) => { setSheetEvent(ev); setAddDate(null) }} eventsOverride={filteredEventsOverride} />
      </div>
      <SpiralCanvas
        onTapEmpty={(d) => { setAddDate(d); setSheetEvent(null) }}
        onTapEvent={(ev) => { setSheetEvent(ev); setAddDate(null) }}
        eventsOverride={filteredEventsOverride}
      />

      {/* FAB menu */}
      {showFabMenu && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setShowFabMenu(false)} />
          <div className="absolute bottom-20 left-4 flex flex-col gap-2 z-40">
            <button
              onClick={() => { setShowFabMenu(false); setAddType('task'); setAddDate(needle); setSheetEvent(null) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-lg text-sm font-extrabold text-gray-700 border border-gray-200"
            >
              <span className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-base font-black">✅</span>
              {tr.newTask}
            </button>
            <button
              onClick={() => { setShowFabMenu(false); setAddType('event'); setAddDate(needle); setSheetEvent(null) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-lg text-sm font-extrabold text-gray-700 border border-gray-200"
            >
              <span className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-base font-black">📅</span>
              {tr.newEvent}
            </button>
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowFabMenu(v => !v)}
        className={`absolute bottom-4 left-4 rounded-full text-white text-3xl shadow-lg flex items-center justify-center z-30 transition-all ${showFabMenu ? 'bg-red-500 rotate-45' : 'bg-blue-500'}`}
        style={{ width: 52, height: 52 }}
      >
        +
      </button>

      {(sheetEvent || addDate) && (
        <EventSheet event={sheetEvent} defaultDate={addDate} defaultItemType={addType} onClose={closeSheet} />
      )}

      {showSearch && (
        <SearchOverlay
          events={events}
          onClose={() => setShowSearch(false)}
          onSelect={ev => { setSheetEvent(ev); setShowSearch(false) }}
        />
      )}
    </div>
  )
}

