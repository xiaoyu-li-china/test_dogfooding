'use client'

import { MetricsResponse } from '@/types'

interface SummaryCardsProps {
  summary: MetricsResponse['summary']
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toLocaleString('zh-CN')
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(2) + '%'
}

function formatCurrency(num: number): string {
  if (num >= 10000) {
    return '¥' + (num / 10000).toFixed(1) + '万'
  }
  return '¥' + num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

interface CardProps {
  title: string
  value: string
  color: string
}

function StatCard({ title, value, color }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>
        {value}
      </p>
    </div>
  )
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        title="总 PV"
        value={formatNumber(summary.totalPv)}
        color="text-blue-600"
      />
      <StatCard
        title="总 UV"
        value={formatNumber(summary.totalUv)}
        color="text-green-600"
      />
      <StatCard
        title="总订单数"
        value={formatNumber(summary.totalOrders)}
        color="text-amber-600"
      />
      <StatCard
        title="总销售额"
        value={formatCurrency(summary.totalRevenue)}
        color="text-red-600"
      />
      <StatCard
        title="平均转化率"
        value={formatPercent(summary.avgConversionRate)}
        color="text-purple-600"
      />
      <StatCard
        title="平均客单价"
        value={formatCurrency(summary.avgOrderValue)}
        color="text-indigo-600"
      />
    </div>
  )
}
