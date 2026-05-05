import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { localISODate } from '../../hooks/useSpiralMath'
import type { CalendarEvent } from '../../types'
import EventSheet from '../EventSheet'
import YearMonthFilter from '../YearMonthFilter'

interface Props { onBack: () => void }

export default function TasksScreen({ onBack }: Props) {
  const { events, categories, updateEvent, addEvent, batchUpdateSortOrder } = useAppStore()
  const { tr, rtl } = useLang()
  const [editTask, setEditTask] = useState<CalendarEvent | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(localISODate())
  const [newCat, setNewCat] = useState(categories[0]?.id ?? '')
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [pendingDone, setPendingDone] = useState<CalendarEvent | null>(null)
  const [pendingCat, setPendingCat] = useState('')
  const [reactivateTask, setReactivateTask] = useState<CalendarEvent | null>(null)
  const [newDueDate, setNewDueDate] = useState('')
  const [completedYear, setCompletedYear] = useState<number | null>(null)
  const [completedMonth, setCompletedMonth] = useState<number | null>(null)
  const [searchCompleted, setSearchCompleted] = useState('')
  const [searchActive, setSearchActive] = useState('')
  const [showSearchActive, setShowSearchActive] = useState(false)
  const [gcalOnlyCompleted, setGcalOnlyCompleted] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!categories.find(c => c.id === newCat)) setNewCat(categories[0]?.id ?? '')
  }, [categories, newCat])

  useEffect(() => { setCompletedYear(null); setCompletedMonth(null); setGcalOnlyCompleted(false) }, [filterCat])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const tasks = events.filter(e => e.itemType === 'task')
  const filtered = filterCat ? tasks.filter(t => t.categoryId === filterCat) : tasks
  const searchActiveLower = searchActive.toLowerCase()
  const active = filtered
    .filter(e => !e.done)
    .filter(t => !searchActive || t.title.toLowerCase().includes(searchActiveLower) || (t.note ?? '').toLowerCase().includes(searchActiveLower))
    .sort((a, b) => {
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) return a.sortIndex - b.sortIndex
      if (a.sortIndex !== undefined) return -1
      if (b.sortIndex !== undefined) return 1
      return a.date > b.date ? 1 : -1
    })
  const allCompleted = filtered.filter(e => e.done && (!gcalOnlyCompleted || !!e.gcalId)).sort((a, b) => (a.date > b.date ? -1 : 1))
  const completedYears = [...new Set(allCompleted.map(t => parseInt(t.date?.slice(0, 4) ?? '0')).filter(y => y > 2000))].sort((a, b) => b - a).slice(0, 8)
  const completed = allCompleted
    .filter(t => {
      if (completedYear === null) return true
      const y = parseInt(t.date?.slice(0, 4) ?? '0')
      if (y !== completedYear) return false
      if (completedMonth === null) return true
      const m = parseInt(t.date?.slice(5, 7) ?? '0')
      return m === completedMonth
    })
    .filter(t => !searchCompleted || t.title.toLowerCase().includes(searchCompleted.toLowerCase()) || (t.note ?? '').toLowerCase().includes(searchCompleted.toLowerCase()))

  const saveTask = () => {
    if (!newTitle.trim()) return
    addEvent({
      title: newTitle.trim(), itemType: 'task',
      categoryId: newCat || categories[0]?.id || '',
      date: newDate, priority: 'N', done: false, links: [], files: [],
    })
    setNewTitle('')
    setNewDate(localISODate())
    setShowAdd(false)
  }

  const openCheckbox = (task: CalendarEvent) => {
    setPendingDone(task)
    setPendingCat(task.categoryId)
  }

  const confirmDone = () => {
    if (!pendingDone) return
    updateEvent(pendingDone.id, { done: true, categoryId: pendingCat })
    setPendingDone(null)
  }

  const startReactivate = (task: CalendarEvent) => {
    setReactivateTask(task)
    setNewDueDate(localISODate())
  }

  const confirmReactivate = () => {
    if (!reactivateTask || !newDueDate) return
    const { id: _id, gcalId: _gcalId, recurrenceParentId: _rpi, recurrence: _rec, ...rest } = reactivateTask
    addEvent({ ...rest, date: newDueDate, done: false, itemType: 'task' })
    setReactivateTask(null)
  }

  const isOverdue = (date: string) => date < localISODate()

  const moveTask = (taskId: string, dir: 'up' | 'down') => {
    const idx = active.findIndex(t => t.id === taskId)
    if (dir === 'up' && idx <= 0) return
    if (dir === 'down' && idx >= active.length - 1) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    const a = active[idx]
    const b = active[swap]
    const aIdx = a.sortIndex ?? idx
    const bIdx = b.sortIndex ?? swap
    batchUpdateSortOrder([{ id: a.id, sortIndex: bIdx }, { id: b.id, sortIndex: aIdx }])
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] relative">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 h-11 rounded-full bg-blue-500 text-white font-black text-base flex-shrink-0">
          ← {tr.backToBoard}
        </button>
        <span className="font-extrabold text-base text-gray-800 flex-1">✅ {tr.tasks}</span>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="w-8 h-8 rounded-full bg-blue-500 text-white font-black text-xl flex items-center justify-center shadow"
        >{showAdd ? '×' : '+'}</button>
        <button onClick={() => setShowSearchActive(v => !v)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${showSearchActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          🔍
        </button>
        <button
          onClick={() => {
            setCompletedOpen(true)
            setTimeout(() => completedRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }}
          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold"
          title={tr.completedTasks}
        >✓</button>
      </div>

      {showSearchActive && (
        <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-gray-100">
          <input
            autoFocus
            value={searchActive}
            onChange={e => setSearchActive(e.target.value)}
            placeholder={tr.searchPh}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            dir={rtl ? 'rtl' : 'ltr'}
          />
        </div>
      )}

      {/* Category filter strip */}
      <div dir={rtl ? 'rtl' : 'ltr'} className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setFilterCat(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 ${!filterCat ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
        >{tr.all}</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 transition-all"
            style={{
              borderColor: cat.color,
              background: filterCat === cat.id ? cat.color : cat.color + '22',
              color: filterCat === cat.id ? '#fff' : cat.color,
            }}>
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-100 px-4 py-3 flex flex-col gap-2" dir={rtl ? 'rtl' : 'ltr'}>
          <input
            autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveTask()}
            placeholder={tr.taskNamePh}
            className="w-full bg-white border-2 border-blue-300 rounded-xl px-3 py-2.5 text-base font-bold outline-none"
            dir={rtl ? 'rtl' : 'ltr'}
          />
          <div className="flex gap-2">
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
            <select value={newCat} onChange={e => setNewCat(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none" dir={rtl ? 'rtl' : 'ltr'}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl font-bold text-gray-600 text-sm">{tr.cancel}</button>
            <button onClick={saveTask} disabled={!newTitle.trim()}
              className={`flex-[2] py-2.5 rounded-xl font-extrabold text-sm ${newTitle.trim() ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              ✅ {tr.addTask}
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Active tasks */}
        <Section title={`${tr.activeTasks} (${active.length})`} defaultOpen>
          {active.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {showAdd ? tr.taskNamePh : tr.noActiveTasks}
            </p>
          )}
          {active.map(task => {
            const cat = catMap[task.categoryId]
            const overdue = task.date && isOverdue(task.date)
            const subCount = events.filter(e => e.parentId === task.id).length
            return (
              <div key={task.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50 transition-colors"
                style={{ borderRightWidth: 3, borderRightColor: cat?.color ?? '#888' }}
                onClick={() => setEditTask(task)}>
                <button
                  onClick={e => { e.stopPropagation(); openCheckbox(task) }}
                  className="w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center active:bg-green-50"
                  style={{ borderColor: cat?.color ?? '#888' }}
                  title={tr.markDoneTitle}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {task.recurrence && <span className="text-purple-500 mr-1">🔁</span>}
                    {task.recurrenceParentId && <span className="text-purple-400 mr-1 text-[10px]">↩</span>}
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.date && (
                      <span className={`text-[10px] font-mono ${overdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        {overdue ? '⚠️ ' : ''}{task.date}
                      </span>
                    )}
                    {task.durationDays && task.durationDays > 1 && (
                      <span className="text-[9px] font-bold text-purple-500 bg-purple-50 px-1 rounded">{task.durationDays}{tr.timeLeftDays}</span>
                    )}
                    {subCount > 0 && (
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1 rounded">{subCount} {tr.subTasksCountLabel}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveTask(task.id, 'up')} className="w-5 h-4 rounded text-gray-400 text-[10px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 leading-none">▲</button>
                  <button onClick={() => moveTask(task.id, 'down')} className="w-5 h-4 rounded text-gray-400 text-[10px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 leading-none">▼</button>
                </div>
                {cat && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                    style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                    {cat.icon} {cat.name}
                  </span>
                )}
              </div>
            )
          })}
        </Section>

        {/* Completed tasks */}
        <div ref={completedRef}>
        <Section
          title={`${tr.completedTasks} (${completedYear || gcalOnlyCompleted ? completed.length + '/' + filtered.filter(e => e.done).length : completed.length})`}
          defaultOpen={false}
          forceOpen={completedOpen}
          onToggle={setCompletedOpen}
          headerExtra={
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {completedOpen && (
                <button
                  onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-500 border-blue-200"
                >↑ {tr.activeTasks}</button>
              )}
              <button
                onClick={e => { e.stopPropagation(); setGcalOnlyCompleted(v => !v); setCompletedYear(null); setCompletedMonth(null) }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${gcalOnlyCompleted ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-300'}`}
              >📅 G</button>
            </div>
          }
        >
          <YearMonthFilter
            year={completedYear} month={completedMonth} years={completedYears}
            onYear={setCompletedYear} onMonth={setCompletedMonth}
            allLabel={tr.all} monthsShort={tr.monthsShort}
          />
          {/* Search */}
          {allCompleted.length > 4 && (
            <input
              value={searchCompleted}
              onChange={e => setSearchCompleted(e.target.value)}
              placeholder={tr.searchPastPh}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              dir={rtl ? 'rtl' : 'ltr'}
            />
          )}
          {completed.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{tr.noCompletedTasks}</p>
          )}
          {completed.map(task => {
            const cat = catMap[task.categoryId]
            return (
              <div key={task.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100 opacity-60"
                style={{ borderRightWidth: 3, borderRightColor: cat?.color ?? '#888' }}>
                <div className="w-6 h-6 rounded-md bg-green-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-green-500 text-xs font-black">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-500 truncate line-through">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {task.date && <p className="text-[10px] font-mono text-gray-400">{task.date}</p>}
                    {cat && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                        {cat.icon} {cat.name}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => startReactivate(task)}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-500 border border-blue-200 flex-shrink-0">
                  {tr.reactivate}
                </button>
              </div>
            )
          })}
        </Section>
        </div>
      </div>

      {/* Mark-done confirmation modal */}
      {pendingDone && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setPendingDone(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 py-5 shadow-2xl" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-2xl">✅</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-base text-gray-800">{tr.markDoneTitle}</p>
                <p className="text-sm text-gray-500 truncate">"{pendingDone.title}"</p>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{tr.moveToCat}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setPendingCat(cat.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                  style={{
                    borderColor: cat.color,
                    background: pendingCat === cat.id ? cat.color : cat.color + '22',
                    color: pendingCat === cat.id ? '#fff' : cat.color,
                  }}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPendingDone(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">{tr.cancel}</button>
              <button onClick={confirmDone} className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-extrabold">✅ {tr.confirm}</button>
            </div>
          </div>
        </>
      )}

      {/* Reactivate modal */}
      {reactivateTask && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setReactivateTask(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 py-6 shadow-2xl" dir={rtl ? 'rtl' : 'ltr'}>
            <p className="font-extrabold text-base text-gray-800 mb-1">{tr.reactivate}</p>
            <p className="text-sm text-gray-500 mb-4 truncate">"{reactivateTask.title}"</p>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{tr.newDueDate}</p>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm outline-none mb-4" dir="ltr" />
            <div className="flex gap-2">
              <button onClick={() => setReactivateTask(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">{tr.cancel}</button>
              <button onClick={confirmReactivate} className="flex-[2] py-3 bg-blue-500 text-white rounded-xl font-bold">{tr.addActiveTask}</button>
            </div>
          </div>
        </>
      )}

      {editTask && (
        <EventSheet event={editTask} defaultDate={null} forceItemType="task" onClose={() => setEditTask(null)} />
      )}
    </div>
  )
}

function Section({ title, defaultOpen, children, headerExtra, forceOpen, onToggle }: {
  title: string; defaultOpen: boolean; children: React.ReactNode; headerExtra?: React.ReactNode
  forceOpen?: boolean; onToggle?: (v: boolean) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen !== undefined ? forceOpen : open
  const toggle = () => {
    const next = !isOpen
    setOpen(next)
    onToggle?.(next)
  }
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white font-extrabold text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {headerExtra}
        </div>
        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="bg-[#f5f5f7] px-2 pb-2 pt-1 flex flex-col gap-1.5">
          {children}
        </div>
      )}
    </div>
  )
}
