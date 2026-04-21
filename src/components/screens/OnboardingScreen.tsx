interface Props {
  onDone: () => void
}

const STEPS = [
  {
    icon: '🌀',
    title: 'ברוכים הבאים ללוח הספירלה',
    text: 'לוח שנה בצורת עיגול — 12 בלילה למעלה, כיוון השעון = קדימה בזמן.',
  },
  {
    icon: '🔴',
    title: 'המחוג האדום',
    text: 'גרור את המחוג לכל נקודה בזמן. כשהמחוג עומד על אירוע — לחץ שוב כדי לפתוח אותו.',
  },
  {
    icon: '➕',
    title: 'הוספת אירוע',
    text: 'לחץ על ה-+ הכחול, או לחץ על מקום ריק בלוח — ייפתח טופס עם התאריך שבחרת.',
  },
  {
    icon: '📋',
    title: 'קטגוריות וטבעות',
    text: 'כל קטגוריה מוצגת בטבעת נפרדת. לחץ על שם הקטגוריה בסרגל למעלה להסתיר/להציג.',
  },
  {
    icon: '🗓',
    title: 'מצבי תצוגה',
    text: 'יומי, שבועי, חודשי, שנתי — עברו בין המצבים בסרגל התחתון.',
  },
]

export default function OnboardingScreen({ onDone }: Props) {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col items-center justify-between px-6 pt-16 pb-10 overflow-y-auto"
    >
      {/* Logo area */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-5xl shadow-xl">
          🌀
        </div>
        <h1 className="text-2xl font-black text-white text-center leading-snug">
          לוח הספירלה
        </h1>
        <p className="text-blue-200 text-sm text-center">לוח שנה חכם בצורת עיגול</p>
      </div>

      {/* Feature cards */}
      <div className="w-full flex flex-col gap-3 my-6">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-white/10 rounded-2xl px-4 py-3"
          >
            <span className="text-2xl mt-0.5 flex-shrink-0">{s.icon}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{s.title}</p>
              <p className="text-blue-200 text-xs leading-relaxed mt-0.5">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onDone}
        className="w-full py-4 rounded-2xl bg-white text-blue-700 font-black text-lg shadow-xl active:scale-95 transition-transform"
      >
        בואו נתחיל ←
      </button>
    </div>
  )
}
