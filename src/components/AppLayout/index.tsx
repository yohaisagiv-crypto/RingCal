import { useState, useCallback, useEffect, useRef } from 'react'
import { LANGS } from '../../constants/langs'

import SpiralScreen from '../screens/SpiralScreen'
import EventsScreen from '../screens/EventsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import TasksScreen from '../screens/TasksScreen'
import MainMenuScreen from '../screens/MainMenuScreen'
import AIScreen from '../screens/AIScreen'
import SubCalendarScreen from '../screens/SubCalendarScreen'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { pullFromDrive, pushToDrive, getLocalSyncTs } from '../../services/googleDrive'
import { localISODate } from '../../hooks/useSpiralMath'
import type { CalendarEvent } from '../../types'
import EventSheet from '../EventSheet'


function timeRemainingRight(
  ev: CalendarEvent,
  mode: string,
  tr: ReturnType<typeof import('../../i18n/translations').getLang>
): { text: string; hot: boolean } {
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const evMs = new Date(ev.date + 'T00:00:00').getTime()
  const diffDays = Math.round((evMs - todayMs) / 86_400_000)
  if (diffDays === 0 && ev.time) {
    const tMs = new Date(ev.date + `T${ev.time}:00`).getTime()
    const mins = Math.round((tMs - Date.now()) / 60_000)
    if (mins > 0) {
      if (mins < 60) return { text: `${mins}′`, hot: true }
      const hrs = mins / 60
      return { text: `${Math.floor(hrs)}${tr.timeLeftHours}`, hot: hrs < 3 }
    }
  }
  if (diffDays <= 0) return { text: tr.today, hot: true }
  if (diffDays === 1) return { text: tr.tomorrow, hot: true }
  if (mode === 'day') {
    const tMs = ev.time ? new Date(ev.date + `T${ev.time}:00`).getTime() : evMs
    const mins = Math.round((tMs - Date.now()) / 60_000)
    if (mins <= 0) return { text: tr.today, hot: true }
    if (mins < 60) return { text: `${mins}′`, hot: true }
    const hrs = mins / 60
    return { text: `${Math.floor(hrs)}${tr.timeLeftHours}`, hot: hrs < 3 }
  }
  if (mode === 'week') return { text: `${diffDays}${tr.timeLeftDays}`, hot: diffDays <= 2 }
  if (mode === 'month') {
    const w = diffDays / 7
    if (w < 1) return { text: `${diffDays}${tr.timeLeftDays}`, hot: true }
    return { text: `${Math.floor(w)}${tr.timeLeftWeeks}`, hot: w < 1.5 }
  }
  // year
  const mo = diffDays / 30.5
  if (mo < 1) return { text: `${diffDays}${tr.timeLeftDays}`, hot: true }
  return { text: `${Math.floor(mo)}${tr.timeLeftMonths}`, hot: mo < 1.5 }
}

export default function AppLayout() {
  const [page, setPage] = useState(0)
  const {
    bumpSpiralGeneration, subCalendarParentId, setSubCalendarParentId,
    events, categories, settings, mode, needle, gcalConnected, importData, updateSettings,
  } = useAppStore()
  const { tr, rtl } = useLang()
  const pendingCount = events.filter(e => e.rsvpStatus === 'pending').length
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Desktop right panel state ──
  const [desktopSheetEvent, setDesktopSheetEvent] = useState<CalendarEvent | null>(null)
  const [rightFilterCats, setRightFilterCats] = useState<string[]>([])
  const [showCatFilter, setShowCatFilter] = useState(false)
  const [rightTypeFilter, setRightTypeFilter] = useState<'all' | 'event' | 'task'>('all')
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const rightListRef = useRef<HTMLDivElement>(null)
  const rightItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // ── Drive sync ──
  useEffect(() => {
    if (!gcalConnected) return
    pullFromDrive().then(data => {
      if (!data) return
      const driveTs = data.lastSync ?? ''
      const localTs = getLocalSyncTs() ?? ''
      if (driveTs > localTs) {
        importData({
          events:     (data.events     as Parameters<typeof importData>[0]['events'])     ?? undefined,
          categories: (data.categories as Parameters<typeof importData>[0]['categories']) ?? undefined,
          settings:   (data.settings   as Parameters<typeof importData>[0]['settings'])   ?? undefined,
        })
      }
    }).catch(() => {})
  }, [gcalConnected])

  useEffect(() => {
    if (!gcalConnected) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => {
      pushToDrive({ events, categories, settings }).catch(() => {})
    }, 3000)
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current) }
  }, [events, categories, settings, gcalConnected])

  // ── Android back button ──
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
    else setSubCalendarParentId(null)
  }, [bumpSpiralGeneration, setSubCalendarParentId])

  const offset = (i: number) => {
    if (i === page) return 'translate-x-0'
    if (i < page) return 'translate-x-full'
    return '-translate-x-full'
  }

  const tabs = [
    { icon: '🔵', label: tr.tabCalendar },
    { icon: '📋', label: tr.tabEvents },
    { icon: '✅', label: tr.tabTasks },
    { icon: '?',  label: tr.tabMenu },
    { icon: '⚙️', label: tr.tabSettings },
  ]

  // ── Desktop right panel data ──
  const today = localISODate()
  const upcomingDesktop = events
    .filter(e => !e.done && e.date >= today)
    .filter(e => rightFilterCats.length === 0 || rightFilterCats.includes(e.categoryId))
    .filter(e => rightTypeFilter === 'all' || e.itemType === rightTypeFilter)
    .sort((a, b) => (a.date + (a.time ?? '')) < (b.date + (b.time ?? '')) ? -1 : 1)
    .slice(0, 60)
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  // ── Needle-active item ──
  const needleMs = needle.getTime()
  let activeId: string | null = null
  let closestDiff = Infinity
  for (const ev of upcomingDesktop) {
    const evMs = new Date(ev.date + 'T' + (ev.time ?? '00:00') + ':00').getTime()
    const diff = Math.abs(evMs - needleMs)
    if (diff < closestDiff) { closestDiff = diff; activeId = ev.id }
  }

  useEffect(() => {
    if (!activeId || !rightPanelOpen) return
    const el = rightItemRefs.current.get(activeId)
    const list = rightListRef.current
    if (el && list) {
      const elRect = el.getBoundingClientRect()
      const listRect = list.getBoundingClientRect()
      const targetTop = list.scrollTop + elRect.top - listRect.top - (list.clientHeight - el.offsetHeight) / 2
      list.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
  }, [activeId, rightPanelOpen])

  const toggleFilterCat = (id: string) =>
    setRightFilterCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div
      className="flex flex-col h-full overflow-hidden select-none lg:flex-row"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ═══════════════════════════════════════
          Desktop Sidebar
      ═══════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 flex-shrink-0 z-10">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-2xl">🔵</span>
          <span className="font-black text-blue-600 text-xl tracking-tight">RingCal</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => navigateTo(i)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all relative ${
                page === i ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl leading-none relative">
                {tab.icon}
                {i === 1 && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-0.5 leading-none">
                    {pendingCount}
                  </span>
                )}
              </span>
              <span className="flex-1 text-right">{tab.label}</span>
            </button>
          ))}

        </nav>

        {/* Language switcher */}
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{tr.languageLabel}</p>
          <div className="flex flex-wrap gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => updateSettings({ language: l.code })}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                  settings.language === l.code
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Google status */}
        <div className="px-4 py-3 border-t border-gray-100">
          {gcalConnected
            ? <div className="flex items-center gap-2 text-xs font-bold text-green-600"><span>🟢</span> {tr.gcalConnected}</div>
            : <div className="flex items-center gap-2 text-xs text-gray-400"><span>⚪</span> {tr.gcalNotConnected}</div>
          }
        </div>
      </aside>

      {/* ═══════════════════════════════════════
          Main area
      ═══════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">

        {/* Pages */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(0)}`}>
            <SpiralScreen onNavigate={navigateTo} filterCats={rightFilterCats} filterType={rightTypeFilter} />
          </div>
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(1)}`}>
            <EventsScreen onBack={() => navigateTo(0)} />
          </div>
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(2)}`}>
            <TasksScreen onBack={() => navigateTo(0)} />
          </div>
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(3)}`}>
            <MainMenuScreen onNavigate={navigateTo} />
          </div>
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(4)}`}>
            <SettingsScreen onBack={() => navigateTo(0)} />
          </div>
          <div className={`absolute inset-0 transition-transform duration-300 ease-out ${offset(5)}`}>
            <AIScreen onBack={() => navigateTo(0)} />
          </div>

          {/* Sub-calendar overlay */}
          {subCalendarParentId && (
            <div className="absolute inset-0 z-50">
              <SubCalendarScreen />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            Desktop Right Panel — Events & Tasks
        ═══════════════════════════════════════ */}

        {/* Desktop Right Panel toggle button (always visible when panel is closed) */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="hidden lg:flex flex-col items-center justify-center w-8 bg-white border-l border-gray-200 flex-shrink-0 hover:bg-gray-50 transition-colors"
            title={tr.eventsAndTasksLabel}
          >
            <span className="text-gray-400 text-xs font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>📅</span>
          </button>
        )}

        {/* Desktop Right Panel */}
        {rightPanelOpen && (
          <aside className="hidden lg:flex flex-col w-80 bg-white border-l border-gray-200 flex-shrink-0 overflow-hidden">
            {/* Header with collapse button */}
            <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-extrabold text-sm text-gray-700 flex-1">📅 {tr.eventsAndTasksLabel}</span>
                <span className="text-xs text-gray-400 font-mono">{upcomingDesktop.length}</span>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs hover:bg-gray-200 flex-shrink-0"
                  title="סגור פאנל"
                >✕</button>
              </div>
              {/* Type filter */}
              <div className="flex gap-1 mb-1.5">
                {(['all', 'event', 'task'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRightTypeFilter(t)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      rightTypeFilter === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'all' ? tr.all : t === 'event' ? `📅 ${tr.typeEvent}` : `✅ ${tr.typeTask}`}
                  </button>
                ))}
              </div>
              {/* Category filter button */}
              <div className="relative">
                <button
                  onClick={() => setShowCatFilter(v => !v)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${
                    rightFilterCats.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={tr.filterByCat}
                >
                  🔽
                </button>
                {showCatFilter && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowCatFilter(false)} />
                    <div className="absolute top-9 right-0 bg-white shadow-xl rounded-xl border border-gray-200 z-40 w-52 p-2 flex flex-col gap-1">
                      <button
                        onClick={() => { setRightFilterCats([]); setShowCatFilter(false) }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-right w-full transition-all ${
                          rightFilterCats.length === 0 ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${rightFilterCats.length === 0 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                          {rightFilterCats.length === 0 && '✓'}
                        </span>
                        {tr.all}
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => toggleFilterCat(cat.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-right w-full hover:bg-gray-50"
                        >
                          <span
                            className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-white text-[9px] font-black"
                            style={{
                              borderColor: cat.color,
                              background: rightFilterCats.includes(cat.id) ? cat.color : 'transparent',
                            }}
                          >
                            {rightFilterCats.includes(cat.id) && '✓'}
                          </span>
                          <span className="text-sm flex-shrink-0">{cat.icon}</span>
                          <span style={{ color: cat.color }}>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pending RSVP notice */}
            {pendingCount > 0 && (
              <button
                onClick={() => navigateTo(1)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{pendingCount}</span>
                {tr.pendingNotice}
                <span className="ml-auto text-blue-400">›</span>
              </button>
            )}

            {/* List */}
            <div ref={rightListRef} className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-2 py-2" dir={rtl ? 'rtl' : 'ltr'}>
              {upcomingDesktop.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">{tr.noUpcomingEvents}</p>
              )}
              {upcomingDesktop.map(ev => {
                const cat = catMap[ev.categoryId]
                const isTask = ev.itemType === 'task'
                const isPending = ev.rsvpStatus === 'pending'
                const isEvToday = ev.date === today
                const isActive = ev.id === activeId
                const { text: timeText, hot } = timeRemainingRight(ev, mode, tr)
                return (
                  <button
                    key={ev.id}
                    ref={el => { if (el) rightItemRefs.current.set(ev.id, el); else rightItemRefs.current.delete(ev.id) }}
                    onClick={() => setDesktopSheetEvent(ev)}
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-right transition-all ${
                      isActive
                        ? 'bg-blue-50 shadow-sm'
                        : 'bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100'
                    }`}
                    style={isActive ? {
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: cat?.color ?? '#3b82f6',
                      borderLeftWidth: 4,
                    } : undefined}
                  >
                    <div className="flex-shrink-0 flex flex-col items-center w-9 mt-0.5 gap-0.5">
                      <span className="text-[10px] font-mono text-gray-400 leading-none">
                        {ev.date.slice(5).replace('-', '/')}
                      </span>
                      {isEvToday && <span className="text-[8px] font-black text-blue-500 uppercase">{tr.today}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {isPending ? '📬 ' : isTask ? '✅ ' : ''}{ev.title}
                        {ev.gcalId && <span className="inline-block ml-1 text-[9px] font-black bg-blue-100 text-blue-500 px-1 rounded leading-tight">G</span>}
                      </p>
                      {ev.time && <p className="text-[10px] text-gray-400 font-mono">{ev.time}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[9px] font-black rounded px-1 py-0.5 leading-none ${hot ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {timeText}
                      </span>
                      {cat && <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        )}
      </div>

      {/* ═══════════════════════════════════════
          Mobile Tab Bar
      ═══════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-2 bg-white border-t-2 border-gray-200 relative z-[60] lg:hidden">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => navigateTo(i)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl font-extrabold text-xs transition-all duration-200 relative ${
              page === i ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-50 text-gray-500'
            }`}
          >
            <span className="text-lg leading-none mb-0.5 relative">
              {tab.icon}
              {i === 1 && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-0.5 leading-none">
                  {pendingCount}
                </span>
              )}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop EventSheet (from right panel click) */}
      {desktopSheetEvent && (
        <EventSheet
          event={desktopSheetEvent}
          defaultDate={null}
          forceItemType={desktopSheetEvent.itemType === 'task' ? 'task' : 'event'}
          onClose={() => setDesktopSheetEvent(null)}
        />
      )}

    </div>
  )
}
