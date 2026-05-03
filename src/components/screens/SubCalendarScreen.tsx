import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import SpiralCanvas from '../SpiralCanvas'
import TopBar from '../TopBar'
import NeedleBar from '../NeedleBar'
import CategoryStrip from '../CategoryStrip'
import UpcomingStrip from '../UpcomingStrip'
import EventSheet from '../EventSheet'
import type { CalendarEvent, Category } from '../../types'

const PRESET_COLORS = [
  '#4285f4','#ea4335','#fbbc04','#34a853',
  '#8e44ad','#e74c3c','#27ae60','#f39c12',
  '#16a085','#2c3e50','#e67e22','#95a5a6',
]
const PRESET_ICONS = [
  '💼','📚','🎉','🏠','❤️','⭐','🏋️','🎵',
  '✈️','🍕','💊','💰','🎯','📝','🔬','🚗',
]

export default function SubCalendarScreen() {
  const { events, subCalendarParentId, setSubCalendarParentId, needle, categories, updateCategory, updateEvent } = useAppStore()
  const { tr, rtl } = useLang()
  const [sheetEvent, setSheetEvent] = useState<CalendarEvent | null>(null)
  const [addDate, setAddDate] = useState<Date | null>(null)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [showParentSettings, setShowParentSettings] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const [newSubCatName, setNewSubCatName] = useState('')
  const [newSubCatColor, setNewSubCatColor] = useState('#4285f4')
  const [newSubCatIcon, setNewSubCatIcon] = useState('⭐')

  const parentTask = events.find(e => e.id === subCalendarParentId)
  const subTasks = events.filter(e => e.parentId === subCalendarParentId)
  const closeSheet = () => { setSheetEvent(null); setAddDate(null) }

  const sq = searchQuery.trim().toLowerCase()
  const filtered = sq
    ? subTasks.filter(e => e.title.toLowerCase().includes(sq) || (e.note ?? '').toLowerCase().includes(sq))
    : subTasks

  const openCatEdit = (catId: string) => {
    const cat = categories.find(c => c.id === catId)
    if (cat) setEditCat({ ...cat })
  }

  const saveCatEdit = () => {
    if (!editCat || !editCat.name.trim()) return
    updateCategory(editCat.id, editCat)
    setEditCat(null)
  }

  const subCategories: import('../../types').Category[] = parentTask?.subCategories ?? []

  const addSubCategory = () => {
    if (!newSubCatName.trim() || !parentTask) return
    const newCat: import('../../types').Category = {
      id: `sub-${Date.now()}`,
      name: newSubCatName.trim(),
      color: newSubCatColor,
      icon: newSubCatIcon,
      hidden: false,
      ring: 0,
      syncToGcal: false,
    }
    updateEvent(parentTask.id, { subCategories: [...subCategories, newCat] })
    setNewSubCatName('')
  }

  const deleteSubCategory = (id: string) => {
    if (!parentTask) return
    updateEvent(parentTask.id, { subCategories: subCategories.filter(c => c.id !== id) })
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] relative">

      {/* Header */}
      <div className="flex-shrink-0 bg-blue-600 text-white px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => setSubCalendarParentId(null)}
          className="flex items-center gap-1.5 px-3 h-10 rounded-full bg-white/25 font-black text-base flex-shrink-0 border border-white/40"
        ><span className="text-lg">‹</span> {tr.backToBoard}</button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] opacity-70 leading-none mb-0.5">{tr.subCalLabel}</p>
          <p className="font-extrabold text-sm truncate">{parentTask?.title ?? tr.subCalLabel}</p>
        </div>
        <span className="text-xs bg-white/25 px-2 py-1 rounded-full font-bold flex-shrink-0">
          {subTasks.length} · {parentTask?.durationDays ?? 0}{tr.timeLeftDays}
        </span>
        <button
          onClick={() => { if (!parentTask) return; setShowParentSettings(true); setSheetEvent(parentTask) }}
          className="flex items-center gap-1 px-2.5 h-8 rounded-full bg-white/25 font-bold text-sm flex-shrink-0 border border-white/40"
        >⚙️ {tr.calParamsBtn}</button>
        <button
          onClick={() => setShowCatManager(true)}
          className="flex items-center gap-1 px-2.5 h-8 rounded-full bg-white/25 font-bold text-sm flex-shrink-0 border border-white/40"
        >📋 {tr.taskSettings}</button>
      </div>

      <TopBar />
      <NeedleBar onSearch={() => setShowSearch(true)} />
      <CategoryStrip onEdit={openCatEdit} />
      <UpcomingStrip eventsOverride={subTasks} onTap={(ev) => { setSheetEvent(ev); setAddDate(null) }} />

      <SpiralCanvas
        eventsOverride={subTasks}
        onTapEmpty={(d) => { setAddDate(d); setSheetEvent(null) }}
        onTapEvent={(ev) => { setSheetEvent(ev); setAddDate(null) }}
      />

      {/* FAB menu */}
      {showFabMenu && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setShowFabMenu(false)} />
          <div className="absolute left-4 bottom-16 flex flex-col gap-2 z-40">
            <button
              onClick={() => { setShowFabMenu(false); setAddDate(needle); setSheetEvent(null) }}
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-full shadow-lg text-sm font-extrabold text-gray-700 border border-gray-200"
            >
              <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-base">✅</span>
              {tr.newSubTask}
            </button>
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowFabMenu(v => !v)}
        className={`absolute left-4 bottom-4 rounded-full text-white text-3xl shadow-lg flex items-center justify-center z-30 transition-all ${showFabMenu ? 'bg-red-500 rotate-45' : 'bg-blue-500'}`}
        style={{ width: 54, height: 54 }}
      >+</button>

      {/* Event sheet (sub-task or parent settings) */}
      {(sheetEvent || addDate) && (
        <EventSheet
          event={sheetEvent}
          defaultDate={addDate}
          defaultItemType="task"
          forceItemType="task"
          defaultParentId={showParentSettings ? undefined : subCalendarParentId ?? undefined}
          onClose={() => { closeSheet(); setShowParentSettings(false) }}
        />
      )}

      {/* Category quick-edit sheet */}
      {editCat && (
        <>
          <div className="absolute inset-0 bg-black/45 z-40" onClick={() => setEditCat(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 px-4 pb-8 max-h-[75vh] overflow-y-auto" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto my-3" />
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setEditCat(null)} className="w-9 h-9 rounded-full bg-red-500 text-white font-black flex items-center justify-center">×</button>
              <span className="font-mono text-sm font-bold text-blue-500 flex-1 text-center">{tr.editCatInline}</span>
            </div>
            {/* Preview */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
              style={{ background: editCat.color + '18', border: `2px solid ${editCat.color}55` }}>
              <span className="text-3xl">{editCat.icon || '⭐'}</span>
              <span className="text-base font-black" style={{ color: editCat.color }}>{editCat.name || '...'}</span>
            </div>
            {/* Name */}
            <p className="text-xs text-gray-400 font-mono uppercase mb-1">{tr.catName}</p>
            <input value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })}
              placeholder={tr.catNamePh}
              className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2.5 text-base font-bold text-gray-800 outline-none mb-4"
              dir={rtl ? 'rtl' : 'ltr'} autoFocus />
            {/* Icons */}
            <p className="text-xs text-gray-400 font-mono uppercase mb-2">{tr.catIcon}</p>
            <div className="grid grid-cols-8 gap-1.5 mb-4">
              {PRESET_ICONS.map(ic => (
                <button key={ic} onClick={() => setEditCat({ ...editCat, icon: ic })}
                  className={`text-xl h-9 rounded-xl flex items-center justify-center transition-all ${editCat.icon === ic ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-50'}`}>
                  {ic}
                </button>
              ))}
            </div>
            {/* Colors */}
            <p className="text-xs text-gray-400 font-mono uppercase mb-2">{tr.catColor}</p>
            <div className="grid grid-cols-6 gap-2 mb-5">
              {PRESET_COLORS.map(col => (
                <button key={col} onClick={() => setEditCat({ ...editCat, color: col })}
                  className={`h-8 rounded-xl transition-all ${editCat.color === col ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`}
                  style={{ background: col }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditCat(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-bold border border-gray-200">{tr.cancel}</button>
              <button onClick={saveCatEdit} disabled={!editCat.name.trim()} className="flex-[2] py-3.5 bg-blue-500 text-white rounded-2xl font-bold disabled:opacity-40">{tr.save}</button>
            </div>
          </div>
        </>
      )}

      {/* Search overlay */}
      {showSearch && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => { setShowSearch(false); setSearchQuery('') }} />
          <div dir={rtl ? 'rtl' : 'ltr'} className="absolute top-0 left-0 right-0 bg-white shadow-2xl z-50 px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={tr.searchPh}
                className="flex-1 bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                dir={rtl ? 'rtl' : 'ltr'} />
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="w-9 h-9 bg-gray-100 rounded-xl text-gray-500 font-black flex items-center justify-center">✕</button>
            </div>
            {searchQuery.trim() && (
              <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                {filtered.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-4">{tr.noResults}</p>
                  : filtered.map(ev => (
                    <button key={ev.id}
                      onClick={() => { setSheetEvent(ev); setShowSearch(false); setSearchQuery('') }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-right active:bg-blue-50 transition-colors">
                      <span className="text-base flex-shrink-0">✅</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400 font-mono">{ev.date}{ev.time ? ` · ${ev.time}` : ''}</p>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </>
      )}

      {/* Sub-category manager */}
      {showCatManager && (
        <>
          <div className="absolute inset-0 bg-black/45 z-40" onClick={() => setShowCatManager(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 pb-8 max-h-[75vh] overflow-y-auto" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto my-3" />
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowCatManager(false)} className="w-9 h-9 rounded-full bg-red-500 text-white font-black flex items-center justify-center">×</button>
              <span className="font-bold text-sm text-gray-700 flex-1 text-center">{tr.taskSettings}</span>
            </div>
            {/* Existing sub-categories */}
            {subCategories.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {subCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                    style={{ borderColor: cat.color + '44', background: cat.color + '11' }}>
                    <span className="text-lg">{cat.icon}</span>
                    <span className="flex-1 font-bold text-sm" style={{ color: cat.color }}>{cat.name}</span>
                    <button onClick={() => deleteSubCategory(cat.id)}
                      className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-sm font-black">×</button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{tr.addCat}</p>
            <input value={newSubCatName} onChange={e => setNewSubCatName(e.target.value)}
              placeholder={tr.catNamePh}
              className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2.5 text-base font-bold outline-none mb-3"
              dir={rtl ? 'rtl' : 'ltr'} />
            <p className="text-xs text-gray-400 uppercase mb-2">{tr.catIcon}</p>
            <div className="grid grid-cols-8 gap-1.5 mb-3">
              {PRESET_ICONS.map(ic => (
                <button key={ic} onClick={() => setNewSubCatIcon(ic)}
                  className={`text-xl h-9 rounded-xl flex items-center justify-center ${newSubCatIcon === ic ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'}`}>
                  {ic}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 uppercase mb-2">{tr.catColor}</p>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {PRESET_COLORS.map(col => (
                <button key={col} onClick={() => setNewSubCatColor(col)}
                  className={`h-8 rounded-xl ${newSubCatColor === col ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`}
                  style={{ background: col }} />
              ))}
            </div>
            <button onClick={addSubCategory} disabled={!newSubCatName.trim()}
              className={`w-full py-3.5 rounded-xl font-extrabold text-sm ${newSubCatName.trim() ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              + {tr.addCat}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
