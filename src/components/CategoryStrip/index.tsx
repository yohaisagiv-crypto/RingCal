import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'

interface Props {
  onEdit?: (catId: string) => void
  filterCat?: string | null
  onFilter?: (catId: string | null) => void
  onParams?: () => void
}

export default function CategoryStrip({ onEdit, filterCat, onFilter, onParams }: Props) {
  const { categories, updateCategory } = useAppStore()
  const { tr, rtl } = useLang()

  const handleClick = (catId: string) => {
    if (onFilter) {
      onFilter(filterCat === catId ? null : catId)
    } else {
      // Solo mode: if already only this category visible, restore all; otherwise solo it
      const visible = categories.filter(c => !c.hidden)
      const isSolo = visible.length === 1 && visible[0].id === catId
      if (isSolo) {
        // Restore all
        categories.forEach(c => updateCategory(c.id, { hidden: false }))
      } else {
        // Solo: hide all except clicked
        categories.forEach(c => updateCategory(c.id, { hidden: c.id !== catId }))
      }
    }
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="flex-shrink-0 flex flex-wrap gap-2 px-3 py-2 bg-white border-b-2 border-gray-200 shadow-sm items-center">
      {onFilter && (
        <button
          onClick={() => onFilter(null)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all ${
            !filterCat ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}
        >
          {tr.all}
        </button>
      )}
      {categories.map(cat => {
        const isActive = onFilter ? filterCat === cat.id : !cat.hidden
        return (
          <div key={cat.id} className="flex items-center gap-0.5">
            <button
              onClick={() => handleClick(cat.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all"
              style={{
                borderColor: cat.color,
                background: isActive ? cat.color + '80' : 'transparent',
                color: '#111827',
                opacity: isActive ? 1 : 0.5,
              }}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.name}
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(cat.id)}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center hover:bg-gray-200 border border-gray-200"
              >
                {tr.editCatBtn}
              </button>
            )}
          </div>
        )
      })}
      {onParams && (
        <button
          onClick={onParams}
          className="ms-auto w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-sm hover:bg-gray-200 flex-shrink-0"
          title={tr.calParamsBtn}
        >⚙️</button>
      )}
    </div>
  )
}
