import { useAppStore } from '../../store/useAppStore'

export default function CategoryStrip() {
  const { categories, updateCategory } = useAppStore()

  return (
    <div dir="rtl" className="flex-shrink-0 flex flex-wrap gap-2 px-3 py-2 bg-white border-b border-gray-100">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => updateCategory(cat.id, { hidden: !cat.hidden })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
            cat.hidden ? 'opacity-40' : ''
          }`}
          style={{
            borderColor: cat.color,
            background: cat.hidden ? '#f5f5f5' : cat.color + '22',
            color: cat.color,
          }}
        >
          <span
            className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
            style={{ background: cat.color }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  )
}
