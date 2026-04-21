import { useState, useEffect } from 'react'
import TopBar from '../TopBar'
import NeedleBar from '../NeedleBar'
import CategoryStrip from '../CategoryStrip'
import SpiralCanvas from '../SpiralCanvas'
import EventSheet from '../EventSheet'
import UpcomingStrip from '../UpcomingStrip'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent } from '../../types'
import * as gcal from '../../services/googleCalendar'

interface Props {
  onNavigate: (page: number) => void
}

export default function SpiralScreen({ onNavigate }: Props) {
  const [sheetEvent, setSheetEvent] = useState<CalendarEvent | null>(null)
  const [addDate, setAddDate] = useState<Date | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { events, settings, updateSettings, gcalConnected, addEvent, patchEventGcalId, categories } = useAppStore()
  const { tr, rtl } = useLang()

  const closeSheet = () => { setSheetEvent(null); setAddDate(null) }

  const pullFromGcal = async () => {
    if (!gcalConnected || !gcal.isConnected()) return
    try {
      const since = new Date(new Date().getFullYear(), 0, 1)
      const gcalEvents = await gcal.fetchFutureEvents(since)
      const existingIds = new Set(events.map(e => e.gcalId).filter(Boolean))
      for (const ge of gcalEvents) {
        if (existingIds.has(ge.id)) continue
        const imported = gcal.fromGcalEvent(ge)
        const cat = categories[0]?.id ?? ''
        addEvent({ ...imported, categoryId: cat, priority: 'N', done: false, links: [], files: [] })
        const newEv = useAppStore.getState().events.find(e => e.title === imported.title && e.date === imported.date && !e.gcalId)
        if (newEv) patchEventGcalId(newEv.id, ge.id)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    pullFromGcal()
    const onVisible = () => { if (document.visibilityState === 'visible') pullFromGcal() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gcalConnected])

  const filtered = searchQuery.trim()
    ? events.filter(e => e.title.includes(searchQuery) || (e.note ?? '').includes(searchQuery))
    : []

  return (
    <div className="flex flex-col h-full relative bg-[#f5f5f7]">
      <TopBar />
      <NeedleBar onMenu={() => setShowMenu(true)} onSearch={() => setShowSearch(true)} />
      <CategoryStrip />
      <UpcomingStrip onTap={(ev) => { setSheetEvent(ev); setAddDate(null) }} />
      <SpiralCanvas
        onTapEmpty={(d) => { setAddDate(d); setSheetEvent(null) }}
        onTapEvent={(ev) => { setSheetEvent(ev); setAddDate(null) }}
      />

      {/* FAB */}
      <button
        onClick={() => setAddDate(new Date())}
        className="absolute bottom-4 left-4 rounded-full bg-blue-500 text-white text-3xl shadow-lg flex items-center justify-center z-30"
        style={{ width: 52, height: 52 }}
      >
        +
      </button>

      {(sheetEvent || addDate) && (
        <EventSheet event={sheetEvent} defaultDate={addDate} onClose={closeSheet} />
      )}

      {/* Menu overlay */}
      {showMenu && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setShowMenu(false)} />
          <div dir={rtl ? 'rtl' : 'ltr'} className="absolute top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 flex flex-col pt-10 px-4 gap-2">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">{tr.mainMenu}</p>
            <button
              onClick={() => { setShowMenu(false); setShowHelp(true) }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm text-right"
            >
              <span className="text-xl">❓</span>
              {tr.helpTitle}
            </button>
            {[
              { icon: '🌀', label: tr.ringcal, page: 0 },
              { icon: '📋', label: tr.eventsList, page: 1 },
              { icon: '⚙️', label: tr.settings, page: 2 },
            ].map(item => (
              <button
                key={item.page}
                onClick={() => { setShowMenu(false); onNavigate(item.page) }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-800 font-bold text-sm text-right"
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="flex-1" />

            {/* Language quick-switch */}
            <div className="px-1 pb-2">
              <p className="text-[9px] font-mono text-gray-400 uppercase tracking-widest mb-2">שפה / Language</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { code: 'he', label: 'עב' }, { code: 'en', label: 'EN' },
                  { code: 'fr', label: 'FR' }, { code: 'es', label: 'ES' },
                  { code: 'de', label: 'DE' }, { code: 'ru', label: 'RU' },
                  { code: 'ar', label: 'عر' }, { code: 'zh', label: '中' },
                  { code: 'pt', label: 'PT' },
                ].map(l => (
                  <button
                    key={l.code}
                    onClick={() => updateSettings({ language: l.code })}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                      settings.language === l.code
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setShowMenu(false)} className="mb-4 text-sm text-gray-400 font-bold py-2">{tr.close}</button>
          </div>
        </>
      )}

      {/* Help overlay */}
      {showHelp && (
        <>
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowHelp(false)} />
          <div dir="rtl" className="absolute inset-x-2 top-6 bottom-6 bg-white rounded-2xl shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-base text-gray-800">❓ {tr.helpTitle}</span>
              <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-black flex items-center justify-center">✕</button>
            </div>
            <div className="px-4 py-4 flex flex-col gap-5 text-sm text-gray-700 leading-relaxed">
              {tr.help.map((s) => (
                <HelpSection key={s.title} title={s.title} text={s.text} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Search overlay */}
      {showSearch && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => { setShowSearch(false); setSearchQuery('') }} />
          <div dir="rtl" className="absolute top-0 left-0 right-0 bg-white shadow-2xl z-50 px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={tr.searchPlaceholder}
                className="flex-1 bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                dir="rtl"
              />
              <button
                onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="w-9 h-9 bg-gray-100 rounded-xl text-gray-500 font-black flex items-center justify-center flex-shrink-0"
              >
                ✕
              </button>
            </div>
            {searchQuery.trim() && (
              <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                {filtered.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-4">{tr.noResults}</p>
                  : filtered.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => { setSheetEvent(ev); setShowSearch(false); setSearchQuery('') }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-right"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">{ev.title}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{ev.date} {ev.time}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function HelpSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="font-bold text-gray-800 mb-1">{title}</p>
      <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
    </div>
  )
}
