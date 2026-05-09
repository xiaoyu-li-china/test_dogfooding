'use client'

interface DateFilterProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateFilterProps) {
  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    
    onStartDateChange(start.toISOString().split('T')[0])
    onEndDateChange(end.toISOString().split('T')[0])
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setQuickRange(7)}
            className="px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            最近7天
          </button>
          <button
            onClick={() => setQuickRange(14)}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            最近14天
          </button>
          <button
            onClick={() => setQuickRange(30)}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            最近30天
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">开始日期:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">结束日期:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
