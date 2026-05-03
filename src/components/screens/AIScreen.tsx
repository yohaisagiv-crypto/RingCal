import { useState } from 'react'
import { NativeInput } from '../NativeInput'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import EventSheet from '../EventSheet'
import type { CalendarEvent } from '../../types'

interface Props { onBack: () => void; onMenu?: () => void }

const ATTEMPTS = [
  { v: 'v1beta', m: 'gemini-2.5-flash-lite' },
  { v: 'v1beta', m: 'gemini-2.5-flash' },
  { v: 'v1beta', m: 'gemini-2.5-flash-preview-05-20' },
  { v: 'v1beta', m: 'gemini-2.0-flash' },
  { v: 'v1beta', m: 'gemini-1.5-flash' },
]

const APP_CONTEXT = `RingCal היא אפליקציית יומן ספירלי ייחודית.

תצוגה: היומן מוצג כטבעות קונצנטריות עגולות. 12 בלילה למעלה, כיוון השעון = קדימה בזמן. מצבי תצוגה: יום/שבוע/חודש/שנה — כל מצב מציג טווח זמן שונה על אותו לוח עגול.

מחוג אדום: מצביע על נקודת הזמן הנוכחית. ניתן לגרור אותו. לחיצה ראשונה = מזיז מחוג. לחיצה שנייה באותו מקום = פותחת/יוצרת אירוע. כפתורי ← → בסרגל = דלג לאירוע הקודם/הבא בזמן.

קשת אדומה: מציגה את "הזמן הקריטי" — הפרק הקרוב ביותר שצריך לשים לב אליו. גודל הקשת ניתן לכיוון בהגדרות.

פריטים — שני סוגים:
• אירועים (events): יש להם תאריך ושעה אופציונלית, יכולים להיות "כל היום".
• מטלות (tasks): יש להן תאריך יעד, ניתנות לסימון כ"הושלמו".

כל פריט כולל: כותרת, קטגוריה, עדיפות (נמוכה/רגילה/גבוהה/דחוף), הערות, מיקום, קישורים, חזרתיות (ימים/שבועות/חודשים/שנים).

קטגוריות: לכל אירוע/מטלה יש קטגוריה עם שם, צבע ואייקון. כל קטגוריה מוצגת כטבעת נפרדת בלוח. המשתמש יכול ליצור, לערוך ולמחוק קטגוריות. ניתן לסנן לפי קטגוריה.

תת-מטלות (sub-tasks): מטלה יכולה להכיל תת-מטלות עם תת-יומן משלה. ניתן לראות תת-יומן מפורט מתוך כרטיס העריכה של מטלה. הקשרים בין מטלות מחשבים אוטומטית משך זמן כולל.

קישורים בין אירועים: ניתן לקשר בין אירועים/מטלות (FS=סוף→התחלה, SS=התחלה→התחלה, FF=סוף→סוף, SF=התחלה→סוף) עם משך זמן ביניהם.

RSVP: אירועים יכולים להיות במצב: pending (ממתין), accepted (מאושר), declined (נדחה). הזמנות ממתינות מסומנות עם 📬 ומקבלות עדיפות בתצוגה.

Google Calendar: סנכרון דו-כיווני — ייבוא וייצוא אירועים. אירועים מ-GCal מסומנים עם "G". ניתן לייבא היסטוריה (עד 20 שנה אחורה). Google Drive: גיבוי ושחזור נתונים בין מכשירים.

ניווט: לחיצה על נקודה בספירלה פותחת אירוע. כרטיסיית "אירועים" = רשימה עם חיפוש, סינון לפי קטגוריה/שנה/חודש/GCal. כרטיסיית "מטלות" = מטלות פעילות + מושלמות עם ניהול עדיפויות וגרירה. כרטיסיית "הגדרות" = קטגוריות, שפה, Google Calendar, ייצוא/ייבוא.

שפות: עברית, אנגלית, ערבית, צרפתית, ספרדית, גרמנית, רוסית, סינית, פורטוגלית.`

function buildContext(
  events: ReturnType<typeof useAppStore.getState>['events'],
  categories: ReturnType<typeof useAppStore.getState>['categories']
) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const today = new Date().toISOString().slice(0, 10)
  const tasks = events.filter(e => e.itemType === 'task' && !e.done)
  const upcoming = events.filter(e => e.itemType !== 'task' && !e.done && e.date >= today).slice(0, 10)
  const catLines = categories.map(c => `- ${c.icon} ${c.name} (${c.color})`).join('\n') || 'אין קטגוריות'
  const taskLines = tasks.map(t =>
    `- ${t.title}${t.date ? ` (יעד: ${t.date})` : ''}${catMap[t.categoryId] ? ` [${catMap[t.categoryId].name}]` : ''}${t.note ? `: ${t.note}` : ''}`
  ).join('\n') || 'אין מטלות פעילות'
  const eventLines = upcoming.map(e =>
    `- ${e.title} (${e.date}${e.time ? ' ' + e.time : ''})${catMap[e.categoryId] ? ` [${catMap[e.categoryId].name}]` : ''}`
  ).join('\n') || 'אין אירועים קרובים'
  return `${APP_CONTEXT}\n\nהיום: ${today}\n\nקטגוריות:\n${catLines}\n\nמטלות פעילות:\n${taskLines}\n\nאירועים קרובים:\n${eventLines}`
}

interface GeminiMsgs {
  modelUnavailable: string
  keyInvalid: string
  serverError: string
  noAnswer: string
  connectionError: string
}

async function callGemini(apiKey: string, fullPrompt: string, msgs: GeminiMsgs): Promise<string> {
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
    if (res.status === 429 || res.status === 404) { lastError = `${m} ${msgs.modelUnavailable}`; continue }
    if (res.status === 400) { lastError = msgs.keyInvalid; continue }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      lastError = err.error?.message ?? `${msgs.serverError} ${res.status}`
      continue
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? msgs.noAnswer
  }
  throw new Error(lastError || msgs.connectionError)
}

export default function AIScreen({ onBack, onMenu }: Props) {
  const { events, categories, settings, updateSettings } = useAppStore()
  const { tr, rtl } = useLang()
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [keyDraft, setKeyDraft] = useState(settings.geminiApiKey ?? '')
  const [openItem, setOpenItem] = useState<CalendarEvent | null>(null)

  const apiKey = settings.geminiApiKey

  const QUESTIONS = [
    { id: 'priority', label: tr.aiQ_priority, prompt: 'תעדף את המטלות שלי לפי דחיפות וחשיבות. הסבר בקצרה למה.' },
    { id: 'schedule', label: tr.aiQ_schedule, prompt: 'הצע לי תזמון ספציפי לשבוע הקרוב — לאיזה יום ושעה לשייך כל מטלה, בהתחשב באירועים.' },
    { id: 'split',    label: tr.aiQ_split,    prompt: 'זהה מטלות שמורכבות מדי ופרט כל אחת ל-3-5 צעדים קטנים ומעשיים.' },
    { id: 'overdue',  label: tr.aiQ_overdue,  prompt: 'אילו מטלות דורשות טיפול דחוף? הצע לכל אחת תאריך יעד חדש ריאלי.' },
    { id: 'free',     label: tr.aiQ_free,     prompt: '' },
  ]

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
    const fullPrompt = `${context}\n\n${questionText}\n\n${tr.aiResponseLang}`
    setLoading(true); setError('')
    try {
      const newAnswer = await callGemini(apiKey, fullPrompt, {
        modelUnavailable: tr.aiModelUnavailable,
        keyInvalid: tr.aiKeyInvalid,
        serverError: tr.aiServerError,
        noAnswer: tr.aiNoAnswer,
        connectionError: tr.aiConnectionError,
      })
      setHistory(h => [...h, { q: questionText, a: newAnswer }])
      setAnswer(newAnswer)
      if (selectedQ === 'free') setFreeText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.aiUnknownError)
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
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 h-10 rounded-full bg-blue-500 text-white font-black text-sm flex-shrink-0">
          ← {tr.backToBoard}
        </button>
        <span className="font-extrabold text-base text-gray-800 flex-1">{tr.aiTitle}</span>
        {apiKey && (
          <button onClick={() => { setShowSetup(v => !v); setKeyDraft(apiKey) }}
            className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500 text-white border border-green-600">
            {tr.aiConnectedLabel}
          </button>
        )}
        {onMenu && (
          <button onClick={onMenu} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-lg font-black flex-shrink-0">
            ?
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" dir={rtl ? 'rtl' : 'ltr'}>

        {/* === NOT CONNECTED === */}
        {!apiKey && !showSetup && (
          <div className="flex flex-col gap-3">
            <div className="bg-blue-500 rounded-2xl p-5 text-white shadow-lg text-center">
              <div className="text-4xl mb-2">🤖</div>
              <p className="font-extrabold text-lg mb-1">{tr.aiConnectTitle}</p>
              <p className="text-blue-100 text-sm mb-4 leading-relaxed">{tr.aiConnectSub}</p>
              <button
                onClick={() => setShowSetup(true)}
                className="w-full py-4 bg-white text-blue-600 rounded-2xl font-extrabold text-base shadow-md active:scale-95 transition-transform"
              >
                {tr.aiConnectBtn}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-extrabold text-sm text-gray-700 mb-3 text-center">{tr.aiFeatureTitle}</p>
              {tr.aiFeatures.map((t: string) => (
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
                <p className="font-extrabold text-white text-base">{tr.aiHowToGet}</p>
                <p className="text-blue-100 text-xs">{tr.aiHowToSub}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {tr.aiSteps.map((s: { text: string; sub: string }, i: number) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="w-7 h-7 rounded-full bg-blue-500 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
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
                  {tr.aiOpenStudio}
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-extrabold text-sm text-gray-700 mb-2">{tr.aiPasteKey}</p>
              <NativeInput
                value={keyDraft}
                onChange={setKeyDraft}
                placeholder="AIzaSy..."
                className="w-full bg-gray-50 border-2 border-blue-300 rounded-xl px-3 py-2.5 text-sm outline-none font-mono mb-3"
                dir="ltr"
                type="text"
              />
              <button
                onClick={saveKey}
                disabled={!keyDraft.trim()}
                className={`w-full py-3.5 rounded-xl font-extrabold text-base transition-all ${keyDraft.trim() ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}
              >
                {tr.aiSaveConnect}
              </button>
              {apiKey && (
                <button onClick={() => setShowSetup(false)} className="w-full mt-2 py-2 text-sm text-gray-400 font-bold">{tr.cancel}</button>
              )}
            </div>
          </div>
        )}

        {/* === CONNECTED — Q&A === */}
        {apiKey && !showSetup && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <p className="px-4 pt-3 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{tr.aiTopicLabel}</p>
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
              <NativeInput
                value={freeText}
                onChange={setFreeText}
                placeholder={tr.aiFreePh}
                className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-3 text-base outline-none"
                type="text"
                dir={rtl ? 'rtl' : 'ltr'}
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
                {loading ? tr.aiAskingBtn : tr.aiAskBtn}
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-bold leading-relaxed">
                ⚠️ {error}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setShowSetup(true); setKeyDraft(apiKey ?? '') }}
                    className="text-xs px-3 py-1.5 bg-white border border-red-300 rounded-lg font-bold text-red-600">
                    {tr.aiReplaceKey}
                  </button>
                  <button onClick={() => setError('')}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg font-bold text-gray-500">
                    {tr.aiRetry}
                  </button>
                </div>
              </div>
            )}

            {history.slice(0, -1).map((h, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{tr.aiPrevQuestion}</p>
                <button
                  className="text-xs text-blue-500 mb-2 font-bold text-right w-full"
                  onClick={() => { setSelectedQ('free'); setFreeText(h.q) }}
                >
                  ↺ "{h.q}"
                </button>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{h.a}</p>
              </div>
            ))}

            {answer && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{tr.aiAnswerLabel}</p>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{answer}</p>

                {mentionedItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{tr.aiOpenFromListLabel}</p>
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
                  onClick={() => { setAnswer(''); setSelectedQ(null); setFreeText(''); setHistory([]) }}
                  className="mt-4 w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-extrabold text-blue-600"
                >
                  {tr.aiNewQuestion}
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
