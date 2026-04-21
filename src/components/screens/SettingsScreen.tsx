import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import type { Category } from '../../types'
import * as gcal from '../../services/googleCalendar'

const LANGS = [
  { code: 'he', label: 'עברית' }, { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' }, { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' }, { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' }, { code: 'zh', label: '中文' },
  { code: 'pt', label: 'Português' },
]

const PRESET_COLORS = [
  '#4285f4','#ea4335','#fbbc04','#34a853',
  '#8e44ad','#e74c3c','#27ae60','#f39c12',
  '#16a085','#2c3e50','#e67e22','#95a5a6',
  '#1abc9c','#d35400','#c0392b','#7f8c8d',
]

const PRESET_ICONS = [
  '💼','📚','🎉','🏠','❤️','⭐','🏋️','🎵',
  '✈️','🍕','💊','💰','🎯','📝','🔬','🚗',
  '🐕','🌱','🎮','📷','🏖️','🎨','⚽','🛒',
]

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, updateCriticalTime, categories, updateCategory,
          addCategory, deleteCategory, reorderCategory,
          events, gcalConnected, setGcalConnected, addEvent, patchEventGcalId } = useAppStore()
  const { tr } = useLang()
  const [gcalStatus, setGcalStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [gcalError, setGcalError] = useState('')
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [isNewCat, setIsNewCat] = useState(false)

  const openNew = () => {
    const maxRing = categories.length > 0 ? Math.max(...categories.map(c => c.ring)) + 1 : 0
    setEditCat({ id: '', name: '', color: PRESET_COLORS[0], icon: '⭐', hidden: false, ring: maxRing, syncToGcal: true })
    setIsNewCat(true)
  }

  const openEdit = (cat: Category) => {
    setEditCat({ ...cat })
    setIsNewCat(false)
  }

  const closeEditor = () => { setEditCat(null); setIsNewCat(false) }

  const saveEditor = () => {
    if (!editCat || !editCat.name.trim()) return
    if (isNewCat) {
      const { id: _id, ...rest } = editCat
      addCategory(rest)
    } else {
      updateCategory(editCat.id, editCat)
    }
    closeEditor()
  }

  const pullFromGcal = async () => {
    if (!gcalConnected || !gcal.isConnected()) return
    setGcalStatus('syncing')
    try {
      const since = new Date(new Date().getFullYear(), 0, 1)
      const gcalEvents = await gcal.fetchFutureEvents(since)
      const existingIds = new Set(events.map(e => e.gcalId).filter(Boolean))
      for (const ge of gcalEvents) {
        if (existingIds.has(ge.id)) continue
        const imported = gcal.fromGcalEvent(ge)
        addEvent({ ...imported, categoryId: categories[0]?.id ?? '', priority: 'N', done: false, links: [], files: [] })
        const newEv = useAppStore.getState().events.find(e => e.title === imported.title && e.date === imported.date && !e.gcalId)
        if (newEv) patchEventGcalId(newEv.id, ge.id)
      }
      setGcalStatus('idle')
    } catch (e) {
      setGcalStatus('error')
      setGcalError(e instanceof Error ? e.message : 'שגיאה')
    }
  }

  const connectGcal = async () => {
    setGcalStatus('syncing')
    setGcalError('')
    try {
      await gcal.authorize()
      const now = new Date()
      const localFuture = events.filter(e => new Date(e.date) >= now)
      const blocked = new Set(categories.filter(c => !c.syncToGcal).map(c => c.id))
      await gcal.initialSync(
        localFuture,
        blocked,
        (imported) => addEvent({ ...imported, categoryId: categories[0]?.id ?? '', priority: 'N', done: false, links: [], files: [] }),
        (localId, gcalId) => patchEventGcalId(localId, gcalId),
      )
      setGcalConnected(true)
      setGcalStatus('idle')
    } catch (e) {
      setGcalStatus('error')
      setGcalError(e instanceof Error ? e.message : 'שגיאה לא ידועה')
    }
  }

  const disconnectGcal = () => {
    gcal.clearAuth()
    setGcalConnected(false)
    setGcalStatus('idle')
  }

  const changeCrit = (key: 'day' | 'week' | 'month' | 'year', d: number) => {
    const cur = settings.criticalTime[key] ?? (key === 'year' ? 2 : 0)
    updateCriticalTime({ [key]: Math.max(0, Math.round((cur + d) * 2) / 2) })
  }

  const sortedCats = [...categories].sort((a, b) => a.ring - b.ring)

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] relative">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <button onClick={onBack} className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full flex-shrink-0">
          {tr.backToBoard}
        </button>
        <span className="font-mono text-lg font-black text-gray-800 flex-1 text-center">⚙️ {tr.settings}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">

        {/* Language */}
        <S label={tr.language}>
          <div className="flex flex-wrap gap-2 p-3">
            {LANGS.map(l => (
              <button key={l.code} onClick={() => updateSettings({ language: l.code })}
                className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                  settings.language === l.code ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}>{l.label}</button>
            ))}
          </div>
        </S>

        {/* Google Calendar */}
        <S label={tr.googleCal}>
          {gcalConnected ? (
            <>
              <Row icon="✅" title={tr.gcalConnected} sub={tr.gcalConnectedSub}
                action={tr.gcalDisconnect} onPress={disconnectGcal} />
              <Row icon="🔄" title={tr.gcalSync} sub={gcalStatus === 'syncing' ? tr.gcalSyncing : tr.gcalSyncSub ?? 'משוך אירועים חדשים מגוגל'}
                action={gcalStatus === 'syncing' ? '...' : '↻'} onPress={pullFromGcal} last />
            </>
          ) : (
            <>
              <Row
                icon="📅"
                title={tr.gcalConnect}
                sub={gcalStatus === 'syncing' ? tr.gcalSyncing : gcalStatus === 'error' ? `Error: ${gcalError}` : tr.gcalConnectSub}
                action={gcalStatus === 'syncing' ? '...' : tr.gcalConnectBtn}
                onPress={connectGcal}
                last
              />
              {import.meta.env.DEV && !(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.endsWith('.apps.googleusercontent.com') && (
                <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
                  <p className="text-[10px] font-mono text-yellow-700 font-bold mb-1">⚠️ DEV: נדרש Client ID</p>
                  <ol className="text-[10px] text-yellow-700 list-decimal pr-4 flex flex-col gap-0.5">
                    <li>console.cloud.google.com → New Project</li>
                    <li>Enable Google Calendar API</li>
                    <li>Credentials → OAuth 2.0 → Web app</li>
                    <li>Origin: <span className="font-mono">http://localhost:3000</span></li>
                    <li>קובץ <span className="font-mono">.env</span>: הדבק VITE_GOOGLE_CLIENT_ID=…</li>
                    <li>הפעל מחדש את npm run dev</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </S>

        {/* Display */}
        <S label={tr.display}>
          <Row icon="🔗" title={tr.depLinks} sub={tr.depLinksSub}
            action={
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${settings.showDepLinks ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {settings.showDepLinks ? tr.shown : tr.hidden}
              </span>
            }
            onPress={() => updateSettings({ showDepLinks: !settings.showDepLinks })} last />
        </S>

        {/* Category rings */}
        <S label={tr.catRings}>
          {sortedCats.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
              {/* Order buttons */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => reorderCategory(cat.id, -1)}
                  disabled={i === 0}
                  className="w-5 h-5 rounded text-[10px] bg-gray-100 text-gray-500 disabled:opacity-20 flex items-center justify-center leading-none"
                >▲</button>
                <button
                  onClick={() => reorderCategory(cat.id, 1)}
                  disabled={i === sortedCats.length - 1}
                  className="w-5 h-5 rounded text-[10px] bg-gray-100 text-gray-500 disabled:opacity-20 flex items-center justify-center leading-none"
                >▼</button>
              </div>

              {/* Color swatch + icon */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: cat.color + '28', border: `2px solid ${cat.color}` }}>
                {cat.icon}
              </div>

              {/* Name + ring info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(cat)}>
                <p className="text-sm font-bold text-gray-800 truncate">{cat.name}</p>
                <p className="text-[10px] font-mono text-gray-400">{tr.ring} {i + 1}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => updateCategory(cat.id, { syncToGcal: !cat.syncToGcal })}
                  title={cat.syncToGcal ? tr.syncWithGoogle : tr.notSynced}
                  className={`text-base transition-opacity ${cat.syncToGcal ? 'opacity-100' : 'opacity-25'}`}
                >📅</button>
                <button onClick={() => updateCategory(cat.id, { hidden: !cat.hidden })}
                  className="text-xs text-blue-500 font-bold px-1.5 py-0.5 rounded-lg bg-blue-50">
                  {cat.hidden ? tr.showCat : tr.hideCat}
                </button>
                <button onClick={() => openEdit(cat)}
                  className="text-xs text-gray-500 font-bold px-1.5 py-0.5 rounded-lg bg-gray-100">
                  ✏️
                </button>
              </div>
            </div>
          ))}
          <button onClick={openNew} className="w-full text-center text-sm text-blue-500 font-bold py-3">{tr.addCat}</button>
        </S>

        {/* Critical time */}
        <S label={tr.criticalTime}>
          <div className="px-4 py-3 flex flex-col gap-4">
            <p className="text-sm font-semibold text-gray-600">{tr.criticalSub}</p>
            {([
              { key: 'day'   as const, label: tr.critDaily,   unit: tr.unitHours, delta: 0.5 },
              { key: 'week'  as const, label: tr.critWeekly,  unit: tr.unitDays,  delta: 0.5 },
              { key: 'month' as const, label: tr.critMonthly, unit: tr.unitDays,  delta: 1 },
              { key: 'year'  as const, label: tr.critYearly,  unit: tr.unitMonths,delta: 1 },
            ]).map(({ key, label, unit, delta }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label} ({unit})</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => changeCrit(key, -delta)}
                    className="w-8 h-8 bg-gray-100 rounded-lg font-bold text-lg text-gray-600">−</button>
                  <span className="font-mono text-base font-bold text-red-500 w-8 text-center">
                    {settings.criticalTime[key]}
                  </span>
                  <button onClick={() => changeCrit(key, delta)}
                    className="w-8 h-8 bg-gray-100 rounded-lg font-bold text-lg text-gray-600">+</button>
                </div>
              </div>
            ))}
          </div>
        </S>

        {/* Tools */}
        <S label={tr.tools}>
          <Row icon="🖨️" title={tr.print} action={tr.printBtn} onPress={() => window.print()} last />
        </S>

      </div>

      {/* Category editor sheet */}
      {editCat && (
        <CategoryEditor
          cat={editCat}
          isNew={isNewCat}
          onChange={(c) => setEditCat(c)}
          onSave={saveEditor}
          onDelete={() => { deleteCategory(editCat.id); closeEditor() }}
          onClose={closeEditor}
          tr={tr as unknown as Record<string, string>}
          canDelete={!isNewCat && categories.length > 1}
        />
      )}
    </div>
  )
}

function CategoryEditor({
  cat, isNew, onChange, onSave, onDelete, onClose, tr, canDelete
}: {
  cat: Category
  isNew: boolean
  onChange: (c: Category) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  tr: Record<string, string>
  canDelete: boolean
}) {
  const nameError = cat.name.trim() === ''

  return (
    <>
      <div className="absolute inset-0 bg-black/45 z-40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto px-4 pb-8">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto my-3" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-red-500 text-white font-black flex items-center justify-center shadow-md">×</button>
          <span className="font-mono text-sm font-bold text-blue-500 flex-1 text-center">
            {isNew ? tr.addCat : tr.editCat ?? 'ערוך קטגוריה'}
          </span>
          {canDelete && (
            <button onClick={onDelete} className="border border-red-400 text-red-500 text-xs rounded-lg px-3 py-1">
              {tr.delete}
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
          style={{ background: cat.color + '18', border: `2px solid ${cat.color}55` }}>
          <span className="text-3xl">{cat.icon || '⭐'}</span>
          <span className="text-base font-black" style={{ color: cat.color }}>{cat.name || '...'}</span>
        </div>

        {/* Name */}
        <p className="text-[10px] text-gray-400 font-mono uppercase mb-1">{tr.catName ?? 'שם קטגוריה'}</p>
        <input
          value={cat.name}
          onChange={e => onChange({ ...cat, name: e.target.value })}
          placeholder={tr.catNamePh ?? 'שם...'}
          className={`w-full bg-gray-50 border-2 rounded-xl px-3 py-2.5 text-base font-bold text-gray-800 outline-none mb-4 ${nameError ? 'border-red-400' : 'border-blue-300'}`}
          dir="rtl"
          autoFocus
        />

        {/* Icon picker */}
        <p className="text-[10px] text-gray-400 font-mono uppercase mb-2">{tr.catIcon ?? 'אייקון'}</p>
        <div className="grid grid-cols-8 gap-1.5 mb-4">
          {PRESET_ICONS.map(ic => (
            <button key={ic} onClick={() => onChange({ ...cat, icon: ic })}
              className={`text-xl h-9 rounded-xl flex items-center justify-center transition-all ${
                cat.icon === ic ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-50'
              }`}>
              {ic}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <p className="text-[10px] text-gray-400 font-mono uppercase mb-2">{tr.catColor ?? 'צבע'}</p>
        <div className="grid grid-cols-8 gap-1.5 mb-5">
          {PRESET_COLORS.map(col => (
            <button key={col} onClick={() => onChange({ ...cat, color: col })}
              className={`h-8 rounded-xl transition-all ${cat.color === col ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`}
              style={{ background: col }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-base font-bold border border-gray-200">
            {tr.cancel}
          </button>
          <button onClick={onSave} disabled={nameError}
            className="flex-[2] py-3.5 bg-blue-500 text-white rounded-2xl text-base font-bold disabled:opacity-40">
            {tr.save}
          </button>
        </div>
      </div>
    </>
  )
}

function S({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">{label}</p>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">{children}</div>
    </div>
  )
}

function Row({ icon, title, sub, action, onPress, last }: {
  icon: string; title: string; sub?: string; action?: React.ReactNode; onPress: () => void; last?: boolean
}) {
  return (
    <button onClick={onPress}
      className={`w-full flex items-center gap-3 px-4 py-3 text-right ${last ? '' : 'border-b border-gray-100'}`}>
      <span className="text-xl w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{title}</p>
        {sub && <p className="text-sm font-semibold text-gray-600 mt-0.5">{sub}</p>}
      </div>
      {action && (
        typeof action === 'string'
          ? <span className="text-sm text-blue-500 font-bold flex-shrink-0">{action}</span>
          : action
      )}
    </button>
  )
}
