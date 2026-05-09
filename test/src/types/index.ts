export interface DailyMetrics {
  date: string
  pv: number
  uv: number
  orders: number
  revenue: number
  conversionRate: number
  avgOrderValue: number
}

export interface MetricsResponse {
  data: DailyMetrics[]
  summary: {
    totalPv: number
    totalUv: number
    totalOrders: number
    totalRevenue: number
    avgConversionRate: number
    avgOrderValue: number
  }
}

export type DataSource = 'mock' | 'live'
