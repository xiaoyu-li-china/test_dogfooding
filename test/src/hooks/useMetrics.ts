'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { DataSource, MetricsResponse } from '@/types'
import { getMockDataByDateRange } from '@/data/mockData'

function calculateSummary(data: MetricsResponse['data']): MetricsResponse['summary'] {
  if (data.length === 0) {
    return {
      totalPv: 0,
      totalUv: 0,
      totalOrders: 0,
      totalRevenue: 0,
      avgConversionRate: 0,
      avgOrderValue: 0,
    }
  }

  const totalPv = data.reduce((sum, item) => sum + item.pv, 0)
  const totalUv = data.reduce((sum, item) => sum + item.uv, 0)
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0)
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const avgConversionRate = data.reduce((sum, item) => sum + item.conversionRate, 0) / data.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return {
    totalPv,
    totalUv,
    totalOrders,
    totalRevenue,
    avgConversionRate: parseFloat(avgConversionRate.toFixed(4)),
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
  }
}

export function useMetrics(
  dataSource: DataSource,
  startDate: string,
  endDate: string
) {
  const [data, setData] = useState<MetricsResponse['data']>([])
  const [summary, setSummary] = useState<MetricsResponse['summary']>({
    totalPv: 0,
    totalUv: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgConversionRate: 0,
    avgOrderValue: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestVersionRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return

    requestVersionRef.current += 1
    const currentVersion = requestVersionRef.current

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    setLoading(true)
    setError(null)

    try {
      if (dataSource === 'mock') {
        await new Promise((resolve) => setTimeout(resolve, 300))
        if (signal.aborted || currentVersion !== requestVersionRef.current) return

        const mockData = getMockDataByDateRange(startDate, endDate)
        const mockSummary = calculateSummary(mockData)
        if (signal.aborted || currentVersion !== requestVersionRef.current) return

        setData(mockData)
        setSummary(mockSummary)
      } else {
        const response = await fetch(
          `/api/metrics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
          { signal }
        )

        if (signal.aborted || currentVersion !== requestVersionRef.current) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const result: MetricsResponse = await response.json()
        if (signal.aborted || currentVersion !== requestVersionRef.current) return

        setData(result.data)
        setSummary(result.summary)
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      if (currentVersion === requestVersionRef.current) {
        setError(errorMessage)
      }
      console.error('Failed to fetch metrics:', err)
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setLoading(false)
      }
    }
  }, [dataSource, startDate, endDate])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  return {
    data,
    summary,
    loading,
    error,
    refetch: fetchData,
  }
}
