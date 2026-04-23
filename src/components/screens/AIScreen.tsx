import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import EventSheet from '../EventSheet'
import type { CalendarEvent } from '../../types'

interface Props { onBack: () => void }

const QUESTIONS = [
  { id: 'priority', label: '🎯 תעדוף מטלות', prompt: 'תעדף את המטלות שלי לפי דחיפות וחשיבות. הסבר בקצרה למה.' },
  { id: 'schedule', label: '📅 תזמון לשבוע', prompt: 'הצע לי תזמון ספציפי לשבוע הקרוב — לאיזה יום ושעה לשייך כל מטלה, בהתחשב באירועים.' },
  { id: 'split',    label: '🔪 פיצול מטלות',  prompt: 'זהה מטלות שמורכבות מדי ופרט כל אחת ל-3-5 צעדים קטנים ומעשיים.' },
  { id: 'overdue',  label: '⚠️ מטלות שפג מועדן', prompt: 'אילו מטלות דורשות טיפול דחוף? הצע לכל אחת תאריך יעד חדש ריאלי.' },
  { id: 'free',     label: '✏️ שאלה חופשית',  prompt: '' },
]

const ATTEMPTS = [
  { v: 'v1beta', m: 'gemini-2.5-flash-lite' },
  { v: 'v1beta', m: 'gemini-2.5-flash' },
  { v: 'v1beta', m: 'gemini-2.5-flash-preview-05-20' },
  { v: 'v1beta', m: 'gemini-2.0-flash' },
  { v: 'v1beta', m: 'gemini-1.5-flash' },
]

function buildContext(
  events: ReturnType<typeof useAppStore.getState>['events'],
  categories: ReturnType<typeof useAppStore.getState>['categories']
) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const today = new Date().toISOString().slice(0, 10)
  const tasks = events.filter(e => e.itemType === 'task' && !e.done)
  const upcoming = events.filter(e => e.itemType !== 'task' && !e.done && e.date >= today).slice(0, 10)
  const taskLines = tasks.map(t =>
    `- ${t.title}${t.date ? ` (יעד: ${t.date})` : ''}${catMap[t.categoryId] ? ` [${catMap[t.categoryId].name}]` : ''}${t.note ? `: ${t.note}` : ''}`
  ).join('\n') || 'אין מטלות פעילות'
  const eventLines = upcoming.map(e =>
    `- ${e.title} (${e.date}${e.time ? ' ' + e.time : ''})`
  ).join('\n') || 'אין אירועים קרובים'
  return `היום: ${today}\n\nמטלות פעילות:\n${taskLines}\n\nאירועים קרובים:\n${eventLines}`
}

async function callGemini(apiKey: string, fullPrompt: string): Promise<string> {
  let lastError = ''
  for (const { v, m } of ATTEMPTS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
      }
    )
    if (res.status === 429 || res.status === 404) { lastError = `${m} לא זמין`; continue }
    if (res.status === 400) { lastError = 'מפתח לא תקין — בדוק שהעתקת נכון'; continue }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      lastError = err.error?.message ?? `שגיאה ${res.status}`
      continue
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'לא התקבלה תשובה'
  }
  throw new Error(lastError || 'לא ניתן להתחבר לג׳ימיני. בדוק את המפתח ונסה שנית.')
}

const STEPS = [
  { n: '1', text: 'פתח את הקישור הכחול למטה', sub: 'ייפתח אתר של גוגל' },
  { n: '2', text: 'התחבר עם חשבון Gmail שלך', sub: 'אם אין לך — צור חשבון חינם' },
  { n: '3', text: 'לחץ על "Create API key"', sub: 'כפתור כחול בפינה הימנית העליונה של הדף' },
  { n: '4', text: 'העתק את המפתח שנוצר', sub: 'שורה של אותיות ומספרים' },
  { n: '5', text: 'הדבק אותו בשדה למטה ולחץ שמור', sub: 'ואתה מוכן!' },
]

export default function AIScreen({ onBack }: Props) {
  const { events, categories, settings, updateSettings } = useAppStore()
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [keyDraft, setKeyDraft] = useState(settings.geminiApiKey ?? '')
  const [openItem, setOpenItem] = useState<CalendarEvent | null>(null)

  const apiKey = settings.geminiApiKey

  const mentionedItems = answer
    ? events.filter(e => answer.includes(e.title) && e.title.length > 2)
    : []

  const ask = async () => {
    const q = QUESTIONS.find(q => q.id === selectedQ)
    if (!q) return
    const questionText = q.id === 'free' ? freeText.trim() : q.prompt
    if (!questionText) return
    if (!apiKey) { setShowSetup(true); return }
    const context = buildContext(events, categories)
    const fullPrompt = `${context}\n\n${questionText}\n\nענה בעברית, בצורה תמציתית ומעשית.`
    setLoading(true); setAnswer(''); setError('')
    try {
      setAnswer(await callGemini(apiKey, fullPrompt))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה')
    } finally {
      setLoading(false)
    }
  }

  const saveKey = () => {
    updateSettings({ geminiApiKey: keyDraft.trim() || undefined })
    setShowSetup(false)
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-black flex items-center justify-center">‹</button>
        <span className="font-extrabold text-base text-gray-800 flex-1">🤖 עוזר AI — ניתוח מטלות</span>
        {apiKey && (
          <button onClick={() => { setShowSetup(v => !v); setKeyDraft(apiKey) }}
            className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
            ✓ מחובר
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" dir="rtl">

        {/* === NOT CONNECTED === */}
        {!apiKey && !showSetup && (
          <div className="flex flex-col gap-3">
            <div className="bg-blue-500 rounded-2xl p-5 text-white shadow-lg text-center">
              <div className="text-4xl mb-2">🤖</div>
              <p className="font-extrabold text-lg mb-1">חבר את Gemini AI</p>
              <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                Gemini הוא עוזר AI חינמי של גוגל שיעזור לך לתעדף ולתכנן את המטלות שלך
              </p>
              <button
                onClick={() => setShowSetup(true)}
                className="w-full py-4 bg-white text-blue-600 rounded-2xl font-extrabold text-base shadow-md active:scale-95 transition-transform"
              >
                🔑 התחבר עכשיו — חינם לגמרי
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-extrabold text-sm text-gray-700 mb-3 text-center">מה תוכל לעשות אחרי החיבור?</p>
              {['🎯 לקבל סדר עדיפויות למטלות שלך', '📅 לקבל הצעת תזמון שבועי', '🔪 לפרק מטלות גדולות לצעדים קטנים', '✏️ לשאול כל שאלה על לוח הזמנים שלך'].map(t => (
                <p key={t} className="text-sm text-gray-600 py-1 border-b border-gray-50 last:border-0">{t}</p>
              ))}
            </div>
          </div>
        )}

        {/* === SETUP WIZARD === */}
        {showSetup && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-blue-500 px-4 py-3">
                <p className="font-extrabold text-white text-base">איך מקבלים מפתח חינמי?</p>
                <p className="text-blue-100 text-xs">תהליך של 2 דקות — לא צריך כרטיס אשראי</p>
              </div>
              <div className="divide-y divide-gray-50">
                {STEPS.map(s => (
                  <div key={s.n} className="flex items-start gap-3 px-4 py-3">
                    <span className="w-7 h-7 rounded-full bg-blue-500 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{s.text}</p>
                      <p className="text-xs text-gray-400">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 pt-2">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 text-white rounded-xl font-extrabold text-sm"
                >
                  🌐 פתח את Google AI Studio (שלב 1)
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-extrabold text-sm text-gray-700 mb-2">שלב 4 — הדבק את המפתח כאן:</p>
              <input
                value={keyDraft}
                onChange={e => setKeyDraft(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2.5 text-sm outline-none font-mono mb-3"
                dir="ltr"
                type="password"
                autoComplete="off"
              />
              <button
                onClick={saveKey}
                disabled={!keyDraft.trim()}
                className={`w-full py-3.5 rounded-xl font-extrabold text-base transition-all ${keyDraft.trim() ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}
              >
                ✅ שמור והתחבר
              </button>
              {apiKey && (
                <button onClick={() => setShowSetup(false)} className="w-full mt-2 py-2 text-sm text-gray-400 font-bold">ביטול</button>
              )}
            </div>
          </div>
        )}

        {/* === CONNECTED — Q&A === */}
        {apiKey && !showSetup && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <p className="px-4 pt-3 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">בחר נושא לניתוח</p>
              {QUESTIONS.map(q => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQ(q.id)}
                  className={`w-full text-right px-4 py-3 text-sm font-bold border-t border-gray-50 transition-all ${
                    selectedQ === q.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {selectedQ === 'free' && (
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="כתוב את שאלתך כאן..."
                rows={3}
                className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                dir="rtl"
              />
            )}

            {selectedQ && (
              <button
                onClick={ask}
                disabled={loading || (selectedQ === 'free' && !freeText.trim())}
                className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all shadow-md ${
                  loading ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white active:bg-blue-600'
                }`}
              >
                {loading ? '⏳ מנתח...' : '🤖 שאל את Gemini'}
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-bold leading-relaxed">
                ⚠️ {error}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setShowSetup(true); setKeyDraft(apiKey ?? '') }}
                    className="text-xs px-3 py-1.5 bg-white border border-red-300 rounded-lg font-bold text-red-600">
                    החלף מפתח
                  </button>
                  <button onClick={() => setError('')}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg font-bold text-gray-500">
                    נסה שוב
                  </button>
                </div>
              </div>
            )}

            {answer && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">תשובת Gemini</p>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{answer}</p>

                {mentionedItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">פתח מהרשימה</p>
                    <div className="flex flex-col gap-1.5">
                      {mentionedItems.map(item => (
                        <button key={item.id} onClick={() => setOpenItem(item)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-right">
                          <span className="text-sm">{item.itemType === 'task' ? '✅' : '📅'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-blue-700 truncate">{item.title}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{item.date}</p>
                          </div>
                          <span className="text-blue-400 text-sm">›</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setAnswer(''); setSelectedQ(null); setFreeText('') }}
                  className="mt-4 w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-extrabold text-blue-600"
                >
                  ↺ שאלה חדשה
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {openItem && (
        <EventSheet
          event={openItem}
          defaultDate={null}
          forceItemType={openItem.itemType === 'task' ? 'task' : 'event'}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  )
}
