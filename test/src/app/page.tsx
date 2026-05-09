'use client'

import { useState } from 'react'
import { useMetrics } from '@/hooks/useMetrics'
import { DataSource } from '@/types'
import { DateFilter } from '@/components/DateFilter'
import { DataSourceToggle } from '@/components/DataSourceToggle'
import { SummaryCards } from '@/components/SummaryCards'
import { MetricsChart } from '@/components/MetricsChart'
import { MetricsTable } from '@/components/MetricsTable'
import { ExportButton } from '@/components/ExportButton'
import { Loading } from '@/components/Loading'
import { Error } from '@/components/Error'

function getDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export default function Home() {
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [startDate, setStartDate] = useState(getDefaultDateRange().startDate)
  const [endDate, setEndDate] = useState(getDefaultDateRange().endDate)

  const { data, summary, loading, error, refetch } = useMetrics(
    dataSource,
    startDate,
    endDate
  )

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">内部运营指标看板</h1>
          <p className="mt-2 text-gray-600">监控和分析核心业务指标</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2">
            <DateFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>
          <div>
            <DataSourceToggle
              dataSource={dataSource}
              onToggle={setDataSource}
            />
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <Error message={error} onRetry={refetch} />
        ) : (
          <>
            <div className="mb-8">
              <SummaryCards summary={summary} />
            </div>

            <div className="mb-8">
              <MetricsChart data={data} />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-800">详细数据</h2>
                  <span className="text-sm text-gray-500">
                    共 {data.length} 条记录
                  </span>
                </div>
                <ExportButton
                  startDate={startDate}
                  endDate={endDate}
                  disabled={data.length === 0}
                />
              </div>
              <MetricsTable data={data} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
