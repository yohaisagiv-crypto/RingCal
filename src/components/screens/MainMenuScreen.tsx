import { useState } from 'react'
import type React from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { LANGS } from '../../constants/langs'
import EventSheet from '../EventSheet'
import { GEMINI_SYSTEM_PROMPT } from '../../constants/geminiSystemPrompt'
import type { CalendarEvent } from '../../types'

interface Props {
  onNavigate: (page: number) => void
}

const GEMINI_ATTEMPTS = [
  { v: 'v1beta', m: 'gemini-2.5-flash-lite' },
  { v: 'v1beta', m: 'gemini-2.5-flash' },
  { v: 'v1beta', m: 'gemini-2.0-flash' },
  { v: 'v1beta', m: 'gemini-1.5-flash' },
]

async function callGemini(apiKey: string, userPrompt: string): Promise<string> {
  let lastErr = ''
  for (const { v, m } of GEMINI_ATTEMPTS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        }),
      }
    )
    if (res.status === 429 || res.status === 404) { lastErr = `${m} unavailable`; continue }
    if (res.status === 400) { lastErr = 'Invalid API key'; continue }
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
      lastErr = e.error?.message ?? `Server error ${res.status}`
      continue
    }
    const d = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No answer'
  }
  throw new Error(lastErr || 'Connection error')
}

function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+|aistudio\.google\.com[^\s]*)/g
  const result: (string | React.ReactElement)[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) result.push(text.slice(last, match.index))
    const url = match[0]
    const href = url.startsWith('http') ? url : `https://${url}`
    result.push(
      <a key={match.index} href={href} target="_blank" rel="noreferrer"
        className="text-blue-600 underline font-bold break-all"
      >{url}</a>
    )
    last = match.index + url.length
  }
  if (last < text.length) result.push(text.slice(last))
  return result
}

export default function MainMenuScreen({ onNavigate }: Props) {
  const { settings, updateSettings, gcalConnected, events, categories } = useAppStore()
  const { tr, rtl } = useLang()

  const [helpOpen, setHelpOpen] = useState(true)
  const [openHelpItem, setOpenHelpItem] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [selectedQ, setSelectedQ] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [openItem, setOpenItem] = useState<CalendarEvent | null>(null)

  const apiKey = settings.geminiApiKey ?? ''

  const QUESTIONS = [
    { id: 'priority', label: tr.aiQ_priority, prompt: 'תעדף את המטלות שלי לפי דחיפות וחשיבות. הסבר בקצרה למה.' },
    { id: 'schedule', label: tr.aiQ_schedule, prompt: 'הצע לי תזמון ספציפי לשבוע הקרוב — לאיזה יום ושעה לשייך כל מטלה, בהתחשב באירועים.' },
    { id: 'split',    label: tr.aiQ_split,    prompt: 'זהה מטלות שמורכבות מדי ופרט כל אחת ל-3-5 צעדים קטנים ומעשיים.' },
    { id: 'overdue',  label: tr.aiQ_overdue,  prompt: 'אילו מטלות דורשות טיפול דחוף? הצע לכל אחת תאריך יעד חדש ריאלי.' },
    { id: 'free',     label: tr.aiQ_free,     prompt: '' },
  ]

  const buildContext = () => {
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
    const today = new Date().toISOString().slice(0, 10)
    const tasks = events.filter(e => e.itemType === 'task' && !e.done)
    const upcoming = events.filter(e => e.itemType !== 'task' && !e.done && e.date >= today).slice(0, 15)
    const overdue = events.filter(e => !e.done && e.date < today).slice(0, 10)
    const catLines = categories.map(c => `- ${c.icon} ${c.name}`).join('\n') || 'No categories'
    const taskLines = tasks.map(t =>
      `- [${t.priority ?? 'N'}] ${t.title}${t.date ? ` (due: ${t.date})` : ''}${catMap[t.categoryId] ? ` [${catMap[t.categoryId].name}]` : ''}${t.note ? ` — ${t.note}` : ''}`
    ).join('\n') || 'No active tasks'
    const eventLines = upcoming.map(e =>
      `- ${e.title} (${e.date}${e.time ? ' ' + e.time : ''})${catMap[e.categoryId] ? ` [${catMap[e.categoryId].name}]` : ''}${e.rsvpStatus === 'pending' ? ' [PENDING RSVP]' : ''}`
    ).join('\n') || 'No upcoming events'
    const overdueLines = overdue.length > 0
      ? overdue.map(e => `- ${e.title} (was due: ${e.date})`).join('\n')
      : 'None'
    return `TODAY: ${today}

CATEGORIES:
${catLines}

ACTIVE TASKS (priority: H=high N=normal L=low):
${taskLines}

UPCOMING EVENTS (next 15):
${eventLines}

OVERDUE ITEMS:
${overdueLines}`
  }

  const askGemini = async () => {
    const q = QUESTIONS.find(q => q.id === selectedQ)
    if (!q || !apiKey) return
    const text = q.id === 'free' ? freeText.trim() : q.prompt
    if (!text) return
    setLoading(true)
    setAiError('')
    try {
      const result = await callGemini(apiKey, `${buildContext()}\n\n${text}\n\n${tr.aiResponseLang}`)
      setAnswer(result)
      if (selectedQ === 'free') setFreeText('')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : tr.aiUnknownError)
    } finally {
      setLoading(false)
    }
  }

  const mentionedItems = answer
    ? events.filter(e => answer.includes(e.title) && e.title.length > 2)
    : []

  const navItems = [
    { icon: '🔵', label: tr.tabCalendar, page: 0 },
    { icon: '📋', label: tr.tabEvents,   page: 1 },
    { icon: '✅', label: tr.tabTasks,    page: 2 },
    { icon: '⚙️', label: tr.settings,   page: 4 },
  ]

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">

      {/* ── Mobile-only top bar ── */}
      <div className="lg:hidden flex-shrink-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3">
        <span className="text-3xl">🔵</span>
        <div>
          <p className="font-black text-blue-600 text-xl tracking-tight">RingCal</p>
          <p className="text-xs text-gray-400">Ring Calendar</p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-3">

          {/* ── Mobile-only: Navigation ── */}
          <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-2">
              {tr.navigation}
            </p>
            {navItems.map(item => (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-gray-50 active:bg-blue-50 transition-colors text-right"
              >
                <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1 font-bold text-gray-800 text-sm">{item.label}</span>
                <span className="text-gray-300 text-lg">›</span>
              </button>
            ))}
          </div>

          {/* ── Mobile-only: Language ── */}
          <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
              {tr.languageLabel}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => updateSettings({ language: l.code })}
                  className={`px-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-0.5 ${
                    settings.language === l.code
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  <span className="text-sm font-black">{l.label}</span>
                  <span className="text-[9px] opacity-70 leading-none">{l.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Mobile-only: Google status ── */}
          <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{gcalConnected ? '🟢' : '⚪'}</span>
            <span className={`text-sm font-bold flex-1 ${gcalConnected ? 'text-green-600' : 'text-gray-400'}`}>
              {gcalConnected ? tr.gcalConnected : tr.gcalNotConnected}
            </span>
            {!gcalConnected && (
              <button
                onClick={() => onNavigate(4)}
                className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
              >
                {tr.gcalConnectBtn}
              </button>
            )}
          </div>

          {/* ── Intro card ── */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🌀</span>
              <span className="font-extrabold text-white text-lg">RingCal</span>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">{tr.helpIntro}</p>
          </div>

          {/* ── Help accordion ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <button
              onClick={() => setHelpOpen(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-right rounded-2xl active:bg-gray-50"
            >
              <span className="text-xl">📖</span>
              <span className="flex-1 font-extrabold text-gray-800 text-base">{tr.helpTitle}</span>
              <span className="text-gray-400 text-sm">{helpOpen ? '▲' : '▼'}</span>
            </button>

            {helpOpen && (
              <div className="px-3 pb-3 border-t border-gray-100 flex flex-col gap-1.5">
                {(tr.help as unknown as { title: string; text: string }[]).map(s => {
                  const parts = s.title.split(' ')
                  const icon = parts[0]
                  const titleText = parts.slice(1).join(' ')
                  const isOpen = openHelpItem === s.title
                  return (
                    <div key={s.title} className="border border-gray-100 rounded-xl mt-1.5">
                      <button
                        onClick={() => setOpenHelpItem(isOpen ? null : s.title)}
                        className="w-full flex items-center gap-3 px-3 py-3 text-right rounded-xl active:bg-gray-50"
                      >
                        <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                          {icon}
                        </span>
                        <span className="flex-1 font-bold text-gray-800 text-sm">{titleText}</span>
                        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                            {renderTextWithLinks(s.text)}
                          </p>
                          {icon === '🤖' && (
                            <a
                              href="https://aistudio.google.com/app/apikey"
                              target="_blank" rel="noreferrer"
                              className="mt-3 w-full py-3 rounded-xl font-extrabold text-sm bg-blue-500 text-white text-center flex items-center justify-center gap-2"
                            >
                              <span>🔑</span>
                              <span>{tr.aiOpenStudio}</span>
                              <span>→</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── AI section ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="flex-1 font-extrabold text-gray-700 text-sm">{tr.aiTitle}</span>
              {apiKey && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {tr.aiConnectedLabel}
                </span>
              )}
            </div>

            {!apiKey ? (
              <div className="p-4 flex flex-col gap-4">
                <p className="text-sm text-gray-600 leading-relaxed">{tr.aiConnectSub}</p>

                {/* Step-by-step guide */}
                <div className="bg-blue-50 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-blue-500">
                    <p className="text-xs font-extrabold text-white">{tr.aiHowToGet}</p>
                    <p className="text-[11px] text-blue-100">{tr.aiHowToSub}</p>
                  </div>
                  {(tr.aiSteps as unknown as { text: string; sub: string }[]).map((s, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 border-b border-blue-100 last:border-0">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{s.text}</p>
                        <p className="text-[11px] text-gray-400">{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank" rel="noreferrer"
                  className="w-full py-3 rounded-xl font-extrabold text-sm bg-blue-500 text-white text-center block"
                >
                  {tr.aiOpenStudio}
                </a>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none font-mono"
                    dir="ltr"
                  />
                  <button
                    onClick={() => { if (keyInput.trim()) updateSettings({ geminiApiKey: keyInput.trim() }) }}
                    disabled={!keyInput.trim()}
                    className={`px-4 py-2 rounded-xl font-extrabold text-sm flex-shrink-0 ${
                      keyInput.trim() ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {tr.aiSaveConnect}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  {QUESTIONS.map(q => (
                    <button
                      key={q.id}
                      onClick={() => { setSelectedQ(q.id); setAnswer(''); setAiError('') }}
                      className={`text-sm font-bold px-3 py-2.5 rounded-xl text-right transition-all ${
                        selectedQ === q.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                {selectedQ === 'free' && (
                  <input
                    value={freeText}
                    onChange={e => setFreeText(e.target.value)}
                    placeholder={tr.aiFreePh}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    dir={rtl ? 'rtl' : 'ltr'}
                  />
                )}

                {selectedQ && (
                  <button
                    onClick={askGemini}
                    disabled={loading || (selectedQ === 'free' && !freeText.trim())}
                    className={`w-full py-3 rounded-xl font-extrabold text-sm ${
                      loading ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white'
                    }`}
                  >
                    {loading ? tr.aiAskingBtn : tr.aiAskBtn}
                  </button>
                )}

                {aiError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-xs text-red-700 font-bold flex-1">⚠️ {aiError}</span>
                    <button onClick={() => setAiError('')} className="text-xs text-gray-400 font-bold">
                      {tr.aiRetry}
                    </button>
                  </div>
                )}

                {answer && (
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
                    <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{answer}</p>
                    {mentionedItems.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {mentionedItems.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setOpenItem(item)}
                            className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-blue-100 text-right"
                          >
                            <span className="text-sm">{item.itemType === 'task' ? '✅' : '📅'}</span>
                            <span className="flex-1 text-xs font-bold text-blue-700 truncate">{item.title}</span>
                            <span className="text-blue-400 text-xs">›</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { setAnswer(''); setSelectedQ(null); setFreeText('') }}
                      className="mt-2 w-full py-2 bg-white border border-blue-200 rounded-lg text-xs font-bold text-blue-600"
                    >
                      {tr.aiNewQuestion}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-gray-300 font-mono pb-2">RingCal · v1.0</p>
        </div>
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
