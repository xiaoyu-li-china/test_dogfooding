import { NextRequest, NextResponse } from 'next/server'
import { getMockDataByDateRange } from '@/data/mockData'
import { DailyMetrics } from '@/types'

const MAX_EXPORT_DAYS = 31

const CSV_HEADERS = [
  '日期',
  'PV',
  'UV',
  '订单数',
  '销售额(元)',
  '转化率(%)',
  '客单价(元)',
]

function formatCsvValue(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generateCsv(data: DailyMetrics[]): string {
  const rows: string[] = []
  
  rows.push(CSV_HEADERS.join(','))
  
  for (const item of data) {
    const row = [
      formatCsvValue(item.date),
      formatCsvValue(item.pv.toLocaleString('zh-CN')),
      formatCsvValue(item.uv.toLocaleString('zh-CN')),
      formatCsvValue(item.orders.toLocaleString('zh-CN')),
      formatCsvValue(item.revenue.toFixed(2)),
      formatCsvValue((item.conversionRate * 100).toFixed(2)),
      formatCsvValue(item.avgOrderValue.toFixed(2)),
    ]
    rows.push(row.join(','))
  }
  
  return '\ufeff' + rows.join('\n')
}

function getFilename(startDate: string, endDate: string): string {
  const today = new Date().toISOString().split('T')[0]
  return `运营指标_${startDate}_${endDate}_${today}.csv`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要参数: startDate 和 endDate' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: '日期格式无效，请使用 YYYY-MM-DD 格式。' },
        { status: 400 }
      )
    }

    if (start > end) {
      return NextResponse.json(
        { error: '开始日期必须小于或等于结束日期' },
        { status: 400 }
      )
    }

    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays > MAX_EXPORT_DAYS) {
      return NextResponse.json(
        { 
          error: `导出范围超过最大允许 ${MAX_EXPORT_DAYS} 天`,
          maxDays: MAX_EXPORT_DAYS,
          currentDays: diffDays
        },
        { status: 400 }
      )
    }

    const data = getMockDataByDateRange(startDate, endDate)
    const csvContent = generateCsv(data)

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(getFilename(startDate, endDate))}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('CSV Export Error:', error)
    return NextResponse.json(
      { error: '导出失败，请稍后重试' },
      { status: 500 }
    )
  }
}
