import { useAppStore } from '../../store/useAppStore'

export default function CategoryStrip() {
  const { categories, updateCategory } = useAppStore()

  return (
    <div dir="rtl" className="flex-shrink-0 flex flex-wrap gap-1.5 px-2.5 py-1.5 bg-white border-b border-gray-100">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => updateCategory(cat.id, { hidden: !cat.hidden })}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
            cat.hidden ? 'opacity-35' : ''
          }`}
          style={{
            borderColor: cat.color + '66',
            background: cat.hidden ? '#f5f5f5' : cat.color + '18',
            color: cat.color,
          }}
        >
          <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ background: cat.color }} />
          {cat.name}
        </button>
      ))}
    </div>
  )
}
