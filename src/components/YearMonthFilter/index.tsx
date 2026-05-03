interface Props {
  year: number | null
  month: number | null
  years: number[]
  onYear: (y: number | null) => void
  onMonth: (m: number | null) => void
  allLabel: string
  monthsShort: readonly string[]
}

const chip = 'flex-shrink-0 rounded-full font-bold border transition-all'

export default function YearMonthFilter({ year, month, years, onYear, onMonth, allLabel, monthsShort }: Props) {
  if (years.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => { onYear(null); onMonth(null) }}
          className={`${chip} px-2.5 py-1 text-[10px] ${!year ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200'}`}
        >{allLabel}</button>
        {years.map(y => (
          <button key={y}
            onClick={() => { onYear(year === y ? null : y); onMonth(null) }}
            className={`${chip} px-2.5 py-1 text-[10px] ${year === y ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200'}`}
          >{y}</button>
        ))}
      </div>
      {year !== null && (
        <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => onMonth(null)}
            className={`${chip} px-2 py-0.5 text-[9px] ${month === null ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}
          >{allLabel}</button>
          {monthsShort.map((m, i) => (
            <button key={i}
              onClick={() => onMonth(month === i + 1 ? null : i + 1)}
              className={`${chip} px-2 py-0.5 text-[9px] ${month === i + 1 ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}
            >{m}</button>
          ))}
        </div>
      )}
    </div>
  )
}
