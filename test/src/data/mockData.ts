import { DailyMetrics } from '@/types'

function generateDateString(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  return date.toISOString().split('T')[0]
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function generateMetricsForDate(dateStr: string): DailyMetrics {
  const basePv = 10000 + Math.random() * 5000
  const uv = basePv * (0.3 + Math.random() * 0.2)
  const orders = uv * (0.05 + Math.random() * 0.03)
  const revenue = orders * (80 + Math.random() * 40)
  const conversionRate = orders / uv
  const avgOrderValue = revenue / orders

  return {
    date: dateStr,
    pv: Math.round(basePv),
    uv: Math.round(uv),
    orders: Math.round(orders),
    revenue: Math.round(revenue),
    conversionRate: parseFloat(conversionRate.toFixed(4)),
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
  }
}

export function generateMockData(days: number = 30): DailyMetrics[] {
  const data: DailyMetrics[] = []
  
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = generateDateString(i)
    data.push(generateMetricsForDate(dateStr))
  }
  
  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function getMockDataByDateRange(startDate: string, endDate: string): DailyMetrics[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const data: DailyMetrics[] = []
  
  const current = new Date(start)
  while (current <= end) {
    const dateStr = formatDate(current)
    data.push(generateMetricsForDate(dateStr))
    current.setDate(current.getDate() + 1)
  }
  
  return data
}

export const mockMetricsData: DailyMetrics[] = generateMockData(30)
