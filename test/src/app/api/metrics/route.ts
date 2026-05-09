import { NextRequest, NextResponse } from 'next/server'
import { getMockDataByDateRange } from '@/data/mockData'
import { DailyMetrics, MetricsResponse } from '@/types'

function calculateSummary(data: DailyMetrics[]): MetricsResponse['summary'] {
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate and endDate' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Please use YYYY-MM-DD format.' },
        { status: 400 }
      )
    }

    if (start > end) {
      return NextResponse.json(
        { error: 'startDate must be less than or equal to endDate' },
        { status: 400 }
      )
    }

    const maxDays = 90
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays > maxDays) {
      return NextResponse.json(
        { error: `Date range exceeds maximum allowed ${maxDays} days` },
        { status: 400 }
      )
    }

    const data = getMockDataByDateRange(startDate, endDate)
    const summary = calculateSummary(data)

    const response: MetricsResponse = {
      data,
      summary,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
