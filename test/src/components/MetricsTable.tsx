'use client'

import { DailyMetrics } from '@/types'

interface MetricsTableProps {
  data: DailyMetrics[]
}

function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(2) + '%'
}

function formatCurrency(num: number): string {
  return '¥' + num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function MetricsTable({ data }: MetricsTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">暂无数据</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                日期
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                PV
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                UV
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                订单数
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                销售额
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                转化率
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                客单价
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.date} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatNumber(item.pv)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatNumber(item.uv)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatNumber(item.orders)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatCurrency(item.revenue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatPercent(item.conversionRate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {formatCurrency(item.avgOrderValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
