import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { CalendarEvent } from '../../types'
import EventSheet from '../EventSheet'

interface Props { onBack: () => void }

export default function TasksScreen({ onBack }: Props) {
  const { events, categories, updateEvent, addEvent } = useAppStore()
  const [editTask, setEditTask] = useState<CalendarEvent | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [newCat, setNewCat] = useState(categories[0]?.id ?? '')
  const [reactivateTask, setReactivateTask] = useState<CalendarEvent | null>(null)
  const [newDueDate, setNewDueDate] = useState('')

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const tasks = events.filter(e => e.itemType === 'task')
  const active = tasks.filter(e => !e.done).sort((a, b) => (a.date > b.date ? 1 : -1))
  const completed = tasks.filter(e => e.done).sort((a, b) => (a.date > b.date ? 1 : -1))

  const saveTask = () => {
    if (!newTitle.trim()) return
    addEvent({
      title: newTitle.trim(),
      itemType: 'task',
      categoryId: newCat || categories[0]?.id || '',
      date: newDate,
      priority: 'N',
      done: false,
      links: [],
      files: [],
    })
    setNewTitle('')
    setNewDate(new Date().toISOString().slice(0, 10))
    setShowAdd(false)
  }

  const markDone = (id: string) => updateEvent(id, { done: true })

  const startReactivate = (task: CalendarEvent) => {
    setReactivateTask(task)
    setNewDueDate(new Date().toISOString().slice(0, 10))
  }

  const confirmReactivate = () => {
    if (!reactivateTask || !newDueDate) return
    const { id: _id, ...rest } = reactivateTask
    addEvent({ ...rest, date: newDueDate, done: false, itemType: 'task' })
    setReactivateTask(null)
  }

  const isOverdue = (date: string) => date < new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] relative">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-black flex items-center justify-center">‹</button>
        <span className="font-extrabold text-base text-gray-800 flex-1">✅ מטלות</span>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="w-8 h-8 rounded-full bg-blue-500 text-white font-black text-xl flex items-center justify-center shadow"
        >{showAdd ? '×' : '+'}</button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-100 px-4 py-3 flex flex-col gap-2" dir="rtl">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveTask()}
            placeholder="שם המטלה..."
            className="w-full bg-white border-2 border-blue-300 rounded-xl px-3 py-2.5 text-base font-bold outline-none"
            dir="rtl"
          />
          <div className="flex gap-2">
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" dir="ltr" />
            <select value={newCat} onChange={e => setNewCat(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none" dir="rtl">
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-2.5 bg-gray-100 rounded-xl font-bold text-gray-600 text-sm">ביטול</button>
            <button onClick={saveTask} disabled={!newTitle.trim()}
              className={`flex-[2] py-2.5 rounded-xl font-extrabold text-sm ${newTitle.trim() ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              ✅ הוסף מטלה
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Active tasks */}
        <Section title={`מטלות פעילות (${active.length})`} defaultOpen>
          {active.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {showAdd ? 'מלא פרטים למעלה והוסף' : 'לחץ + להוספת מטלה'}
            </p>
          )}
          {active.map(task => {
            const cat = catMap[task.categoryId]
            const overdue = task.date && isOverdue(task.date)
            return (
              <div key={task.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100">
                <button
                  onClick={() => markDone(task.id)}
                  className="w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: cat?.color ?? '#888' }}
                />
                <div className="flex-1 min-w-0" onClick={() => setEditTask(task)}>
                  <p className="text-sm font-bold text-gray-800 truncate">{task.title}</p>
                  {task.date && (
                    <p className={`text-[10px] font-mono ${overdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      {overdue ? '⚠️ ' : ''}{task.date}
                    </p>
                  )}
                </div>
                {cat && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                    {cat.icon}
                  </span>
                )}
              </div>
            )
          })}
        </Section>

        {/* Completed tasks */}
        <Section title={`הושלמו (${completed.length})`} defaultOpen={false}>
          {completed.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">אין מטלות שהושלמו</p>
          )}
          {completed.map(task => (
            <div key={task.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100 opacity-60">
              <div className="w-6 h-6 rounded-md bg-green-100 flex-shrink-0 flex items-center justify-center">
                <span className="text-green-500 text-xs font-black">✓</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-500 truncate line-through">{task.title}</p>
                {task.date && <p className="text-[10px] font-mono text-gray-400">{task.date}</p>}
              </div>
              <button onClick={() => startReactivate(task)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-500 border border-blue-200 flex-shrink-0">
                הפעל מחדש
              </button>
            </div>
          ))}
        </Section>
      </div>

      {/* Reactivate modal */}
      {reactivateTask && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setReactivateTask(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 py-6 shadow-2xl" dir="rtl">
            <p className="font-extrabold text-base text-gray-800 mb-1">הפעל מחדש</p>
            <p className="text-sm text-gray-500 mb-4 truncate">"{reactivateTask.title}"</p>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">תאריך יעד חדש</p>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm outline-none mb-4" dir="ltr" />
            <div className="flex gap-2">
              <button onClick={() => setReactivateTask(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">ביטול</button>
              <button onClick={confirmReactivate} className="flex-[2] py-3 bg-blue-500 text-white rounded-xl font-bold">הוסף מטלה פעילה</button>
            </div>
          </div>
        </>
      )}

      {editTask && (
        <EventSheet
          event={editTask}
          defaultDate={null}
          forceItemType="task"
          onClose={() => setEditTask(null)}
        />
      )}
    </div>
  )
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white font-extrabold text-sm text-gray-700">
        {title}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-[#f5f5f7] px-2 pb-2 pt-1 flex flex-col gap-1.5">
          {children}
        </div>
      )}
    </div>
  )
}
