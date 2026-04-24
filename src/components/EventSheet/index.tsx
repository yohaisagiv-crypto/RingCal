import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { CalendarEvent, RecurrenceRule } from '../../types'
import * as gcal from '../../services/googleCalendar'
import { NativeInput, NativeTextarea } from '../NativeInput'

interface Props {
  event: CalendarEvent | null
  defaultDate: Date | null
  defaultItemType?: 'event' | 'task'
  forceItemType?: 'event' | 'task'
  onClose: () => void
}

function shareIcs({ title, date, time, endTime, note, location, id }: {
  title: string; date: string; time?: string; endTime?: string
  note?: string; location?: string; id: string
}) {
  const fmt = (d: string, t?: string) => {
    const base = d.replace(/-/g, '')
    if (!t) return base
    return base + 'T' + t.replace(':', '') + '00'
  }
  const uid = `${id}@ringcal`
  const dtstart = time ? fmt(date, time) : fmt(date)
  const dtend = endTime ? fmt(date, endTime) : dtstart
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RingCal//RingCal//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${title}`,
    note ? `DESCRIPTION:${note.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar' })
  const file = new File([blob], `${title}.ics`, { type: 'text/calendar' })

  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${title}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

const DEP_TYPES = [
  { v: 'FS', label: 'סוף → התחלה' },
  { v: 'SS', label: 'התחלה → התחלה' },
  { v: 'FF', label: 'סוף → סוף' },
  { v: 'SF', label: 'התחלה → סוף' },
] as const

export default function EventSheet({ event, defaultDate, defaultItemType = 'event', forceItemType, onClose }: Props) {
  const { addEvent, addRecurringEvent, updateEvent, deleteEvent, deleteEventCascade, categories, events: allEvents, gcalConnected, patchEventGcalId } = useAppStore()
  const { tr } = useLang()
  const isEdit = !!event
  const effectiveType = forceItemType ?? (event?.itemType ?? defaultItemType)
  const isTask = effectiveType === 'task'
  const sheetTitle = isTask
    ? (isEdit ? 'עריכת מטלה' : 'הוספת מטלה')
    : (isEdit ? tr.editEvent : tr.addEvent)
  const nameLabel = isTask ? 'שם המטלה' : tr.eventName
  const namePlaceholder = isTask ? 'מה צריך לעשות?' : tr.whatPlanned

  const [itemType, setItemType] = useState<'event' | 'task'>(forceItemType ?? event?.itemType ?? defaultItemType)
  const [title, setTitle] = useState(event?.title ?? '')
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? categories[0]?.id ?? '')
  const [date, setDate] = useState(
    event?.date ?? defaultDate?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(event?.endDate ?? '')
  const [time, setTime] = useState(event?.time ?? '')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [note, setNote] = useState(event?.note ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [priority, setPriority] = useState<'L' | 'N' | 'H' | 'U'>(event?.priority ?? 'N')

  // Recurrence state
  const [showRecurrence, setShowRecurrence] = useState(!!(event?.recurrence))
  const [recInterval, setRecInterval] = useState(event?.recurrence?.interval ?? 1)
  const [recUnit, setRecUnit] = useState<RecurrenceRule['unit']>(event?.recurrence?.unit ?? 'weeks')
  const [recEndDate, setRecEndDate] = useState(event?.recurrence?.endDate ?? '')

  // Dependency state
  const [showDep, setShowDep] = useState(!!(event?.dependsOn))
  const [dependsOn, setDependsOn] = useState(event?.dependsOn ?? '')
  const [dependsType, setDependsType] = useState<'FS' | 'SS' | 'FF' | 'SF'>(event?.dependsType ?? 'FS')
  const [lag, setLag] = useState(event?.lag ?? 0)
  const [lagForce, setLagForce] = useState(event?.lagForce ?? false)
  const [titleError, setTitleError] = useState(false)

  const save = async () => {
    if (!title.trim()) { setTitleError(true); return }
    const evData = { title: title.trim(), date, time, endTime, note, location }
    const recurrence: RecurrenceRule | undefined = showRecurrence
      ? { interval: recInterval, unit: recUnit, ...(recEndDate ? { endDate: recEndDate } : {}) }
      : undefined
    const data: Omit<CalendarEvent, 'id'> = {
      title: title.trim(), categoryId, date, time, endTime, note, location, priority,
      ...(endDate ? { endDate } : {}),
      ...(allDay ? { allDay: true } : {}),
      itemType: forceItemType ?? itemType, done: false, links: [], files: [],
      ...(showDep && dependsOn ? { dependsOn, dependsType, lag, lagForce } : {}),
      ...(recurrence ? { recurrence } : {}),
    }
    if (isEdit && event) {
      updateEvent(event.id, data)
      if (gcalConnected && event.gcalId)
        gcal.updateEvent(event.gcalId, evData).catch(() => {})
    } else if (recurrence) {
      addRecurringEvent(data)
    } else {
      addEvent(data)
      if (gcalConnected) {
        gcal.createEvent(evData).then(gcalId => {
          const newEv = useAppStore.getState().events.find(e => e.title === data.title && e.date === data.date)
          if (newEv) patchEventGcalId(newEv.id, gcalId)
        }).catch(() => {})
      }
    }
    onClose()
  }

  const convertTo = (type: 'event' | 'task') => {
    if (event) updateEvent(event.id, { itemType: type })
    onClose()
  }

  const del = () => {
    if (event) {
      if (gcalConnected && event.gcalId) gcal.deleteEvent(event.gcalId).catch(() => {})
      if (event.recurrence) deleteEventCascade(event.id)
      else deleteEvent(event.id)
    }
    onClose()
  }

  const PRIORITIES = [
    { v: 'L', label: tr.low },
    { v: 'N', label: tr.normal },
    { v: 'H', label: tr.high },
    { v: 'U', label: tr.urgent },
  ] as const

  // Events available to link to (exclude self)
  const linkableEvents = allEvents.filter(e => e.id !== event?.id)

  return (
    <>
      <div className="absolute inset-0 bg-black/45 z-40" onClick={onClose} />

      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto px-4 pb-8"
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto my-3" />

        {/* Event / Task toggle — hidden when type is forced */}
        {forceItemType ? (
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-base">{forceItemType === 'task' ? '✅' : '📅'}</span>
            <span className="font-extrabold text-sm text-gray-700">{forceItemType === 'task' ? 'מטלה' : 'אירוע'}</span>
          </div>
        ) : (
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-3">
            {(['event', 'task'] as const).map(t => (
              <button
                key={t}
                onClick={() => setItemType(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-extrabold transition-all ${
                  itemType === t ? 'bg-blue-500 text-white shadow' : 'text-gray-500'
                }`}
              >
                {t === 'event' ? '📅 אירוע' : '✅ מטלה'}
              </button>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-red-500 text-white font-black flex items-center justify-center shadow-md flex-shrink-0"
          >
            ×
          </button>
          <span className="font-mono text-sm font-bold text-blue-500 flex-1 text-center">
            {sheetTitle}
          </span>
          {isEdit && (
            <button onClick={del} className="border border-red-400 text-red-500 text-xs rounded-lg px-3 py-1">
              {tr.delete}
            </button>
          )}
        </div>

        {/* Category */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.category}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
              style={{
                borderColor: cat.color,
                background: categoryId === cat.id ? cat.color : cat.color + '22',
                color: categoryId === cat.id ? '#fff' : cat.color,
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Title */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{nameLabel}</p>
        {titleError && <p className="text-xs text-red-500 font-bold mb-1">{tr.titleRequired}</p>}
        <NativeInput
          value={title}
          onChange={v => { setTitle(v); setTitleError(false) }}
          placeholder={namePlaceholder}
          className={`w-full bg-gray-50 border-2 rounded-xl px-3 py-2.5 text-base font-bold text-gray-800 outline-none mb-3 ${titleError ? 'border-red-400 bg-red-50' : 'border-blue-300'}`}
          dir="rtl"
          autoFocus
        />

        {/* Date + Time */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.date}</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">תאריך סיום</p>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
          </div>
        </div>

        {/* All-day toggle (events only) + time fields */}
        {(forceItemType ?? itemType) === 'event' && (
          <button
            onClick={() => setAllDay(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold mb-2 transition-all ${allDay ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
          >
            <span>{allDay ? '☑️' : '☐'}</span> אירוע כל היום
          </button>
        )}

        {!(allDay && (forceItemType ?? itemType) === 'event') && (
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.startTime}</p>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.endTime}</p>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
            </div>
          </div>
        )}

        {/* Priority */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.priority}</p>
        <div className="flex gap-2 mb-3">
          {PRIORITIES.map(p => (
            <button key={p.v} onClick={() => setPriority(p.v)}
              className={`flex-1 py-2 rounded-xl text-xs font-mono border transition-all ${
                priority === p.v ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Note */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.notes}</p>
        <NativeTextarea value={note} onChange={setNote}
          placeholder={tr.notes_ph} rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3"
          dir="rtl" />

        {/* Location */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">📍 מיקום</p>
        <NativeInput
          value={location}
          onChange={setLocation}
          placeholder="כתובת או שם מקום..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-2"
          dir="rtl"
        />
        {location.trim() && (
          <div className="flex gap-2 mb-3">
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#05C8F7] text-white rounded-xl text-sm font-bold"
            >
              🚗 Waze
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#4285F4] text-white rounded-xl text-sm font-bold"
            >
              🗺️ Maps
            </a>
          </div>
        )}

        {/* Event Link */}
        <button
          onClick={() => setShowDep(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 mb-2 text-sm font-bold text-gray-700"
        >
          <span>🔗 קישור לאירוע / מטלה</span>
          <span className="text-gray-400 text-base">{showDep ? '▲' : '▼'}</span>
        </button>

        {showDep && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-3 flex flex-col gap-3">
            {/* Quick-link buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const cur = new Date(date)
                  const prev = linkableEvents
                    .filter(e => new Date(e.date) < cur)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                  if (prev) setDependsOn(prev.id)
                }}
                className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600"
              >
                {tr.prevEvent}
              </button>
              <button
                onClick={() => {
                  const cur = new Date(date)
                  const next = linkableEvents
                    .filter(e => new Date(e.date) > cur)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
                  if (next) setDependsOn(next.id)
                }}
                className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600"
              >
                {tr.nextEvent}
              </button>
            </div>

            {/* Select event */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.linkedEvent}</p>
              <select
                value={dependsOn}
                onChange={e => setDependsOn(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                dir="rtl"
              >
                <option value="">{tr.chooseEvent}</option>
                {linkableEvents.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.itemType === 'task' ? '✅ ' : '📅 '}{e.title} ({e.date})
                  </option>
                ))}
              </select>
            </div>

            {/* Link type */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.linkType}</p>
              <div className="grid grid-cols-2 gap-2">
                {DEP_TYPES.map(dt => (
                  <button
                    key={dt.v}
                    onClick={() => setDependsType(dt.v)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      dependsType === dt.v
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lag */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.lagLabel}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[9px] text-gray-400 mb-1 text-center">{tr.days_unit}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLag(l => Math.max(0, l - 24))}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">−</button>
                    <span className="flex-1 text-center font-mono font-bold text-sm">{Math.floor(lag / 24)}</span>
                    <button onClick={() => setLag(l => l + 24)}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] text-gray-400 mb-1 text-center">{tr.hours_unit}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLag(l => Math.max(0, l - 1))}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">−</button>
                    <span className="flex-1 text-center font-mono font-bold text-sm">{lag % 24}</span>
                    <button onClick={() => setLag(l => l + 1)}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] text-gray-400 mb-1 text-center">{tr.minutes_unit}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLag(l => Math.max(0, Math.round((l - 0.5) * 10) / 10))}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">−</button>
                    <span className="flex-1 text-center font-mono font-bold text-sm">{Math.round((lag % 1) * 60)}</span>
                    <button onClick={() => setLag(l => Math.round((l + 0.5) * 10) / 10)}
                      className="w-7 h-7 bg-gray-100 rounded-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Force */}
            <button
              onClick={() => setLagForce(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${
                lagForce
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <span>{lagForce ? '⚡' : '💡'}</span>
              {lagForce ? tr.forceLink : tr.guideOnly}
            </button>
          </div>
        )}

        {/* Recurrence */}
        <button
          onClick={() => setShowRecurrence(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border mb-2 text-sm font-bold transition-all ${
            showRecurrence ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <span>🔁 חוזר על עצמו</span>
          <span className="text-xs opacity-70">{showRecurrence ? '▲' : '▼'}</span>
        </button>

        {showRecurrence && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">כל</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setRecInterval(n => Math.max(1, n - 1))}
                  className="w-7 h-7 bg-white border border-gray-200 rounded-lg font-bold text-gray-600">−</button>
                <span className="w-8 text-center font-mono font-bold text-sm">{recInterval}</span>
                <button onClick={() => setRecInterval(n => n + 1)}
                  className="w-7 h-7 bg-white border border-gray-200 rounded-lg font-bold text-gray-600">+</button>
              </div>
              <select
                value={recUnit}
                onChange={e => setRecUnit(e.target.value as RecurrenceRule['unit'])}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                dir="rtl"
              >
                <option value="days">ימים</option>
                <option value="weeks">שבועות</option>
                <option value="months">חודשים</option>
                <option value="years">שנים</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">עד תאריך (אופציונלי)</p>
              <input type="date" value={recEndDate} onChange={e => setRecEndDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" dir="ltr" />
            </div>
            {event?.recurrenceParentId && (
              <p className="text-xs text-purple-600 font-bold">🔁 זוהי מופע של מטלה חוזרת</p>
            )}
          </div>
        )}

        {/* Convert buttons */}
        {isEdit && (forceItemType ?? itemType) === 'event' && (
          <button
            onClick={() => convertTo('task')}
            className="w-full mb-2 py-3 bg-green-500 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            ✅ המר למטלה
          </button>
        )}
        {isEdit && (forceItemType ?? itemType) === 'task' && (
          <button
            onClick={() => convertTo('event')}
            className="w-full mb-2 py-3 bg-blue-400 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            📅 המר לאירוע
          </button>
        )}

        {/* Share / invite */}
        {isEdit && (
          <button
            onClick={() => shareIcs({ title, date, time, endTime, note, location, id: event!.id })}
            className="w-full mb-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
          >
            <span>📨</span> שלח זימון / שתף
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-base font-bold border border-gray-200">
            {tr.cancel}
          </button>
          <button onClick={save}
            className="flex-[2] py-3.5 bg-blue-500 text-white rounded-2xl text-base font-bold">
            {isEdit ? tr.save : tr.confirm}
          </button>
        </div>
      </div>
    </>
  )
}
