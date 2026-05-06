import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { localISODate } from '../../hooks/useSpiralMath'
import type { CalendarEvent, RecurrenceRule } from '../../types'
import * as gcal from '../../services/googleCalendar'
import { NativeInput, NativeTextarea } from '../NativeInput'
interface Props {
  event: CalendarEvent | null
  defaultDate: Date | null
  defaultItemType?: 'event' | 'task'
  forceItemType?: 'event' | 'task'
  defaultParentId?: string
  onClose: () => void
  nested?: boolean
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
  const isAllDay = !time
  const dtstart = isAllDay ? `DTSTART;VALUE=DATE:${fmt(date)}` : `DTSTART:${fmt(date, time)}`
  const nextDay = (() => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('') })()
  const dtend = isAllDay ? `DTEND;VALUE=DATE:${nextDay}` : `DTEND:${endTime ? fmt(date, endTime) : fmt(date, time)}`
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RingCal//RingCal//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    dtstart,
    dtend,
    `SUMMARY:${title}`,
    note ? `DESCRIPTION:${note.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const textBody = [
    `📅 ${title}`,
    `🗓 ${date}${time ? ' ' + time : ''}${endTime ? ' – ' + endTime : ''}`,
    location ? `📍 ${location}` : '',
    note ? `📝 ${note}` : '',
  ].filter(Boolean).join('\n')

  const blob = new Blob([ics], { type: 'text/calendar' })
  const file = new File([blob], `${title}.ics`, { type: 'text/calendar' })

  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title, text: textBody }).catch(() => {})
  } else if (navigator.share) {
    // Android WebView / fallback: share as text
    navigator.share({ title, text: textBody }).catch(() => {})
  } else {
    // Desktop fallback: download .ics
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${title}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export default function EventSheet({ event, defaultDate, defaultItemType = 'event', forceItemType, defaultParentId, onClose, nested = false }: Props) {
  const { addEvent, addRecurringEvent, updateEvent, deleteEvent, deleteEventCascade, categories, events: allEvents, gcalConnected, patchEventGcalId, setSubCalendarParentId } = useAppStore()
  const { tr, rtl } = useLang()
  const isEdit = !!event
  const effectiveType = forceItemType ?? (event?.itemType ?? defaultItemType)
  const isTask = effectiveType === 'task'
  const sheetTitle = isTask
    ? (isEdit ? tr.editTask : tr.addTaskLabel)
    : (isEdit ? tr.editEvent : tr.addEvent)
  const nameLabel = isTask ? tr.nameLabel_task : tr.eventName
  const namePlaceholder = isTask ? tr.namePh_task : tr.whatPlanned

  const [itemType, setItemType] = useState<'event' | 'task'>(forceItemType ?? event?.itemType ?? defaultItemType)
  const [title, setTitle] = useState(event?.title ?? '')
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? categories[0]?.id ?? '')
  const [date, setDate] = useState(
    event?.date ?? (defaultDate ? localISODate(defaultDate) : localISODate())
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

  const [parentId, setParentId] = useState(event?.parentId ?? defaultParentId ?? '')
  const [showParentPicker, setShowParentPicker] = useState(false)
  const [subTaskSheet, setSubTaskSheet] = useState(false)
  const subTasks = allEvents.filter(e => e.parentId === event?.id && e.itemType === 'task')

  // Dependency state
  const [showDep, setShowDep] = useState(!!(event?.dependsOn))
  const [dependsOn, setDependsOn] = useState(event?.dependsOn ?? '')
  const [dependsType, setDependsType] = useState<'FS' | 'SS' | 'FF' | 'SF'>(event?.dependsType ?? 'FS')
  const [lag, setLag] = useState(event?.lag ?? 0)
  const [lagForce, setLagForce] = useState(event?.lagForce ?? false)
  const [reminder, setReminder] = useState<number | undefined>(event?.reminder)
  const [titleError, setTitleError] = useState(false)
  const [endDateError, setEndDateError] = useState(false)
  const [rsvpCatPicker, setRsvpCatPicker] = useState(false)
  const [rsvpCat, setRsvpCat] = useState(event?.categoryId ?? categories[0]?.id ?? '')
  const [rsvpLinkedEventId, setRsvpLinkedEventId] = useState('')

  const save = async () => {
    if (!title.trim()) { setTitleError(true); return }
    if (endDate && endDate < date) { setEndDateError(true); return }
    const evData = { title: title.trim(), date, time, endTime, note, location }
    const recurrence: RecurrenceRule | undefined = showRecurrence
      ? { interval: recInterval, unit: recUnit, ...(recEndDate ? { endDate: recEndDate } : {}) }
      : undefined
    const data: Omit<CalendarEvent, 'id'> = {
      title: title.trim(), categoryId, date, note, location, priority,
      ...(allDay ? { allDay: true } : { time: time || undefined, endTime: endTime || undefined }),
      ...(endDate && endDate >= date ? { endDate } : {}),
      ...(parentId ? { parentId } : {}),
      itemType: forceItemType ?? itemType,
      done: isEdit ? (event!.done ?? false) : false,
      links: isEdit ? (event!.links ?? []) : [],
      files: isEdit ? (event!.files ?? []) : [],
      ...(showDep && dependsOn ? { dependsOn, dependsType, lag, lagForce } : {}),
      recurrence,
      ...(reminder !== undefined ? { reminder } : {}),
    }
    const cat = categories.find(c => c.id === categoryId)
    const shouldSync = gcalConnected && gcal.isConnected() && (cat?.syncToGcal ?? true)
    if (isEdit && event) {
      updateEvent(event.id, data)
      if (shouldSync) {
        if (event.gcalId) {
          gcal.updateEvent(event.gcalId, evData).catch(() => {})
        } else {
          gcal.createEvent(evData).then(gcalId => {
            patchEventGcalId(event.id, gcalId)
          }).catch(() => {})
        }
      }
    } else if (recurrence) {
      addRecurringEvent(data)
    } else {
      const newId = addEvent(data)
      if (shouldSync) {
        gcal.createEvent(evData).then(gcalId => {
          patchEventGcalId(newId, gcalId)
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
      if (gcalConnected && gcal.isConnected()) {
        if (event.gcalId) gcal.deleteEvent(event.gcalId).catch(() => {})
        if (event.recurrence) {
          allEvents
            .filter(e => e.recurrenceParentId === event.id && e.gcalId)
            .forEach(e => gcal.deleteEvent(e.gcalId as string).catch(() => {}))
        }
      }
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

  const DEP_TYPES = [
    { v: 'FS' as const, label: tr.depFS },
    { v: 'SS' as const, label: tr.depSS },
    { v: 'FF' as const, label: tr.depFF },
    { v: 'SF' as const, label: tr.depSF },
  ]

  // Events available to link to (exclude self)
  const linkableEvents = allEvents.filter(e => e.id !== event?.id)
  // All other tasks (for parent picker)
  const otherTasks = allEvents.filter(e => e.id !== event?.id && e.itemType === 'task')
  // Items that link TO this event (incoming links)
  const incomingLinks = event ? allEvents.filter(e => e.dependsOn === event.id) : []

  const [nestedSheet, setNestedSheet] = useState<CalendarEvent | null>(null)
  const [showAdoptPicker, setShowAdoptPicker] = useState(false)
  const [showLinks, setShowLinks] = useState(true)
  const isPending = event?.rsvpStatus === 'pending'

  // Computed link targets
  const outgoingLinkEv = dependsOn ? (allEvents.find(e => e.id === dependsOn) ?? null) : null
  const parentTaskEv = parentId ? (allEvents.find(e => e.id === parentId) ?? null) : null
  const hasLinkedItems = Boolean(outgoingLinkEv || parentTaskEv || incomingLinks.length > 0)
  const adoptableTasks = (isEdit && event)
    ? allEvents.filter(e => e.id !== event.id && e.itemType === 'task' && e.parentId !== event.id)
    : []
  const bdZ = nested ? 'z-[60]' : 'z-40'
  const shZ = nested ? 'z-[70]' : 'z-50'

  return (
    <>
      <div className={`fixed inset-0 bg-black/45 ${bdZ}`} onClick={onClose} />

      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl ${shZ} max-h-[90vh] overflow-y-auto px-4 pb-8
                   lg:bottom-0 lg:top-0 lg:left-auto lg:right-0 lg:w-[520px] lg:max-h-full lg:rounded-l-2xl lg:rounded-r-none lg:rounded-t-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto my-3" />

        {/* RSVP section — always visible when editing */}
        {isEdit && (
          <div className={`mb-3 rounded-xl p-3 ${isPending ? 'border-2 border-blue-200 bg-blue-50' : 'border border-gray-200 bg-gray-50'}`}>
            {isPending && <p className="text-xs font-black text-blue-700 uppercase tracking-wide mb-2">📬 {tr.rsvpPending}</p>}
            {!rsvpCatPicker ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { if (isPending) setRsvpCatPicker(true); else if (event) updateEvent(event.id, { rsvpStatus: 'accepted' }) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold ${event?.rsvpStatus === 'accepted' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 border border-green-300'}`}
                >{tr.rsvpAccept}</button>
                <button
                  onClick={() => { if (event) updateEvent(event.id, { rsvpStatus: 'tentative' }) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold ${event?.rsvpStatus === 'tentative' ? 'bg-yellow-400 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-300'}`}
                >{tr.rsvpTentative}</button>
                <button
                  onClick={() => { if (event) updateEvent(event.id, { rsvpStatus: 'declined', done: true }) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold ${event?.rsvpStatus === 'declined' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 border border-red-300'}`}
                >{tr.rsvpDecline}</button>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">{tr.assignCat}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setRsvpCat(cat.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                      style={{
                        borderColor: cat.color,
                        background: rsvpCat === cat.id ? cat.color : cat.color + '22',
                        color: rsvpCat === cat.id ? '#fff' : cat.color,
                      }}>
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold text-gray-600 mb-1">{tr.assignEvent}</p>
                <div className="max-h-28 overflow-y-auto rounded-xl border border-gray-200 bg-white mb-3" dir={rtl ? 'rtl' : 'ltr'}>
                  <button
                    onClick={() => setRsvpLinkedEventId('')}
                    className={`w-full px-3 py-2 text-xs text-right border-b border-gray-100 ${!rsvpLinkedEventId ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400'}`}
                  >— {tr.noLinkedItems} —</button>
                  {allEvents
                    .filter(e => e.id !== event?.id && !e.done)
                    .sort((a, b) => a.date < b.date ? -1 : 1)
                    .slice(0, 30)
                    .map(e => (
                      <button
                        key={e.id}
                        onClick={() => setRsvpLinkedEventId(e.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-50 last:border-0 text-right ${rsvpLinkedEventId === e.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="text-sm flex-shrink-0">{e.itemType === 'task' ? '✅' : '📅'}</span>
                        <span className={`flex-1 truncate font-bold ${rsvpLinkedEventId === e.id ? 'text-blue-600' : 'text-gray-700'}`}>{e.title}</span>
                        <span className="text-gray-400 font-mono flex-shrink-0">{e.date.slice(5)}</span>
                        {rsvpLinkedEventId === e.id && <span className="text-blue-500 font-black flex-shrink-0">✓</span>}
                      </button>
                    ))
                  }
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setRsvpCatPicker(false)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-700">{tr.cancel}</button>
                  <button
                    onClick={() => {
                      if (event) {
                        updateEvent(event.id, {
                          rsvpStatus: 'accepted',
                          categoryId: rsvpCat,
                          ...(rsvpLinkedEventId ? { dependsOn: rsvpLinkedEventId } : {}),
                        })
                        onClose()
                      }
                    }}
                    className="flex-[2] py-2 bg-green-500 text-white rounded-xl text-sm font-extrabold"
                  >✅ {tr.confirm}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Event / Task toggle — hidden when type is forced */}
        {forceItemType ? (
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-base">{forceItemType === 'task' ? '✅' : '📅'}</span>
            <span className="font-extrabold text-sm text-gray-700">{forceItemType === 'task' ? tr.typeTask : tr.typeEvent}</span>
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
                {t === 'event' ? `📅 ${tr.typeEvent}` : `✅ ${tr.typeTask}`}
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
          dir={rtl ? 'rtl' : 'ltr'}
          autoFocus
        />

        {/* Date + End Date */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.date}</p>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setEndDateError(false) }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.endDateLabel}</p>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setEndDateError(false) }}
              className={`w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm outline-none ${endDateError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} dir="ltr" />
            {endDateError && <p className="text-[10px] text-red-500 font-bold mt-0.5">⚠️ {tr.endDateBeforeStart}</p>}
          </div>
        </div>

        {/* All-day toggle (events only) + time fields */}
        {(forceItemType ?? itemType) === 'event' && (
          <button
            onClick={() => setAllDay(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold mb-2 transition-all ${allDay ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
          >
            <span>{allDay ? '☑️' : '☐'}</span> {tr.allDayEvent}
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

        {/* Reminder */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">🔔 {tr.notificationsEnabled}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {([
            { label: '—', val: undefined },
            { label: '10′', val: 10 },
            { label: '30′', val: 30 },
            { label: '1h', val: 60 },
            { label: '2h', val: 120 },
            { label: '1d', val: 1440 },
          ] as const).map(opt => (
            <button key={String(opt.val)} onClick={() => setReminder(opt.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                reminder === opt.val ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Note */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.notes}</p>
        <NativeTextarea value={note} onChange={setNote}
          placeholder={tr.notes_ph} rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3"
          dir={rtl ? 'rtl' : 'ltr'} />

        {/* Location */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.locationLabel}</p>
        <NativeInput
          value={location}
          onChange={setLocation}
          placeholder={tr.locationPh}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-2"
          dir={rtl ? 'rtl' : 'ltr'}
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

        {/* Parent task picker — for tasks */}
        {(forceItemType ?? itemType) === 'task' && (
          <>
            <button
              onClick={() => setShowParentPicker(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 mb-2 text-sm font-bold text-gray-700"
            >
              <span>{tr.setParentTask}</span>
              <span className="text-xs text-gray-400 truncate ml-2 max-w-[120px]">
                {parentId ? (allEvents.find(e => e.id === parentId)?.title ?? '?') : tr.noParentTask}
              </span>
              <span className="text-gray-400 text-base ml-1">{showParentPicker ? '▲' : '▼'}</span>
            </button>
            {showParentPicker && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 mb-3 max-h-44 overflow-y-auto" dir={rtl ? 'rtl' : 'ltr'}>
                <button
                  onClick={() => { setParentId(''); setShowParentPicker(false) }}
                  className={`w-full px-3 py-2 text-xs text-right border-b border-gray-100 ${!parentId ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400'}`}
                >
                  {tr.noParentTask}
                </button>
                {otherTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); setParentId(t.id); setShowParentPicker(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-50 last:border-0 text-right ${
                      parentId === t.id ? 'bg-blue-50' : 'active:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">✅</span>
                    <span className={`flex-1 truncate font-bold ${parentId === t.id ? 'text-blue-600' : 'text-gray-700'}`}>{t.title}</span>
                    <span className="text-gray-400 font-mono flex-shrink-0">{t.date.slice(5)}</span>
                    {parentId === t.id && <span className="text-blue-500 font-black flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Event Link */}
        <button
          onClick={() => setShowDep(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 mb-2 text-sm font-bold text-gray-700"
        >
          <span>{tr.linkSection}</span>
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
              <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white" dir={rtl ? 'rtl' : 'ltr'}>
                <button
                  onClick={() => setDependsOn('')}
                  className={`w-full px-3 py-2 text-xs text-right border-b border-gray-100 ${!dependsOn ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400'}`}
                >
                  {tr.chooseEvent}
                </button>
                {linkableEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); setDependsOn(e.id); setShowDep(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-50 last:border-0 text-right ${
                      dependsOn === e.id ? 'bg-blue-50' : 'active:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{e.itemType === 'task' ? '✅' : '📅'}</span>
                    <span className={`flex-1 truncate font-bold ${dependsOn === e.id ? 'text-blue-600' : 'text-gray-700'}`}>{e.title}</span>
                    <span className="text-gray-400 font-mono flex-shrink-0">{e.date.slice(5)}</span>
                    {dependsOn === e.id && <span className="text-blue-500 font-black flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
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
                    <span className="flex-1 text-center font-mono font-bold text-sm">{Math.floor(lag % 24)}</span>
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

        {/* Linked items — always visible, collapsible */}
        <div className="mb-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowLinks(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide"
          >
            <span>{tr.linkedItemsTitle}{hasLinkedItems ? ` (${incomingLinks.length + (outgoingLinkEv ? 1 : 0) + (parentTaskEv ? 1 : 0)})` : ''}</span>
            <span className="text-gray-400">{showLinks ? '▲' : '▼'}</span>
          </button>
          {showLinks && (
            <div className="px-3 pb-3 flex flex-col gap-1">
              {!hasLinkedItems && <p className="text-xs text-gray-400 text-center py-1">{tr.noLinkedItems}</p>}
              {parentTaskEv && (
                <button
                  onClick={() => setNestedSheet(parentTaskEv)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-purple-100 hover:bg-purple-50 hover:border-purple-200 w-full text-right transition-all"
                  title={tr.openForEdit}
                >
                  <span className="text-sm flex-shrink-0">↑</span>
                  <span className="flex-1 text-xs font-bold text-gray-700 truncate">
                    <span className="text-purple-400 text-[10px] font-normal ml-1">{tr.parentTaskLabel}:</span> {parentTaskEv.title}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{parentTaskEv.date.slice(5)}</span>
                  <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                </button>
              )}
              {outgoingLinkEv && (
                <button
                  onClick={() => setNestedSheet(outgoingLinkEv)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-blue-100 hover:bg-blue-50 hover:border-blue-200 w-full text-right transition-all"
                  title={tr.openForEdit}
                >
                  <span className="text-sm flex-shrink-0">{outgoingLinkEv.itemType === 'task' ? '✅' : '📅'}</span>
                  <span className="flex-1 text-xs font-bold text-gray-700 truncate">
                    <span className="text-blue-400 text-[10px] font-normal ml-1">{tr.linksTo}:</span> {outgoingLinkEv.title}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{outgoingLinkEv.date.slice(5)}</span>
                  <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                </button>
              )}
              {incomingLinks.length > 0 && (
                <>
                  {(parentTaskEv || outgoingLinkEv) && (
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1 px-1">{tr.linkedFrom}</p>
                  )}
                  {incomingLinks.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setNestedSheet(e)}
                      className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 w-full text-right transition-all"
                      title={tr.openForEdit}
                    >
                      <span className="text-sm flex-shrink-0">{e.itemType === 'task' ? '✅' : '📅'}</span>
                      <span className="flex-1 text-xs font-bold text-gray-700 truncate">{e.title}</span>
                      <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{e.date.slice(5)}</span>
                      <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <button
          onClick={() => setShowRecurrence(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border mb-2 text-sm font-bold transition-all ${
            showRecurrence ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <span>{tr.recurSection}</span>
          <span className="text-xs opacity-70">{showRecurrence ? '▲' : '▼'}</span>
        </button>

        {showRecurrence && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">{tr.everyLabel}</span>
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
                dir={rtl ? 'rtl' : 'ltr'}
              >
                <option value="days">{tr.recurDays}</option>
                <option value="weeks">{tr.recurWeeks}</option>
                <option value="months">{tr.recurMonths}</option>
                <option value="years">{tr.recurYears}</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">{tr.endDateOpt}</p>
              <input type="date" value={recEndDate} onChange={e => setRecEndDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" dir="ltr" />
            </div>
            {event?.recurrenceParentId && (
              <p className="text-xs text-purple-600 font-bold">{tr.recurInstance}</p>
            )}
          </div>
        )}

        {/* Sub-tasks — only for existing tasks */}
        {isEdit && isTask && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{tr.subTasksSection}</p>
              {event?.durationDays != null && subTasks.length > 0 && (
                <span className="text-xs font-mono text-purple-600 font-bold">
                  {tr.totalDays}: {event.durationDays} {tr.unitDays}
                </span>
              )}
            </div>
            {subTasks.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {subTasks.map(st => (
                  <button
                    key={st.id}
                    onClick={() => setNestedSheet(st)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 active:scale-[.98] text-right w-full transition-all"
                    title={tr.openForEdit}
                  >
                    <span className="text-base flex-shrink-0">{st.done ? '✅' : '⬜'}</span>
                    <span className="flex-1 text-sm font-bold text-gray-700 truncate">{st.title}</span>
                    {st.durationDays && (
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">{st.durationDays}{tr.timeLeftDays}</span>
                    )}
                    <span className="text-xs text-gray-400 flex-shrink-0">{st.date.slice(5)}</span>
                    <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setSubTaskSheet(true)}
                className="flex-1 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-600 flex items-center justify-center gap-1"
              >
                {tr.addSubTaskBtn}
              </button>
              {subTasks.length > 0 && (
                <button
                  onClick={() => { setSubCalendarParentId(event!.id); onClose() }}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1"
                >
                  {tr.openSubCalBtn}
                </button>
              )}
            </div>
            {adoptableTasks.length > 0 && (
              <>
                <button
                  onClick={() => setShowAdoptPicker(v => !v)}
                  className="w-full mt-2 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 flex items-center justify-center gap-1"
                >
                  {tr.adoptSubTaskBtn}
                </button>
                {showAdoptPicker && (
                  <div className="bg-white rounded-xl border border-gray-200 mt-1 max-h-40 overflow-y-auto" dir={rtl ? 'rtl' : 'ltr'}>
                    {adoptableTasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { updateEvent(t.id, { parentId: event!.id }); setShowAdoptPicker(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-50 last:border-0 text-right hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm flex-shrink-0">✅</span>
                        <span className="flex-1 truncate font-bold text-gray-700">{t.title}</span>
                        <span className="text-gray-400 font-mono flex-shrink-0">{t.date.slice(5)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Convert buttons */}
        {isEdit && (forceItemType ?? itemType) === 'event' && (
          <button
            onClick={() => convertTo('task')}
            className="w-full mb-2 py-3 bg-green-500 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            {tr.convertToTaskBtn}
          </button>
        )}
        {isEdit && (forceItemType ?? itemType) === 'task' && (
          <button
            onClick={() => convertTo('event')}
            className="w-full mb-2 py-3 bg-blue-400 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            {tr.convertToEventBtn}
          </button>
        )}

        {/* Share / invite */}
        {isEdit && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => shareIcs({ title, date, time, endTime, note, location, id: event!.id })}
              className="flex-1 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
            >
              {tr.shareBtn}
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`📅 ${title}\n🗓 ${date}${time ? ' ' + time : ''}${endTime ? ' – ' + endTime : ''}${location ? '\n📍 ' + location : ''}${note ? '\n📝 ' + note : ''}`)}`}
              className="flex-1 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
            >
              {tr.emailShareBtn}
            </a>
          </div>
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
      {subTaskSheet && event && (
        <EventSheet
          event={null}
          defaultDate={new Date(event.date + 'T00:00:00')}
          forceItemType="task"
          defaultParentId={event.id}
          onClose={() => setSubTaskSheet(false)}
          nested
        />
      )}
      {nestedSheet && (
        <EventSheet
          event={nestedSheet}
          defaultDate={null}
          forceItemType={nestedSheet.itemType === 'task' ? 'task' : 'event'}
          onClose={() => setNestedSheet(null)}
          nested
        />
      )}
    </>
  )
}
