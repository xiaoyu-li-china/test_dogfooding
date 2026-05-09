'use client'

import { useState } from 'react'

const MAX_EXPORT_DAYS = 31

interface ExportButtonProps {
  startDate: string
  endDate: string
  disabled?: boolean
}

function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

export function ExportButton({ startDate, endDate, disabled }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dayCount = getDayCount(startDate, endDate)
  const isOverLimit = dayCount > MAX_EXPORT_DAYS

  const handleExport = async () => {
    if (isOverLimit || exporting || disabled) return

    setExporting(true)
    setError(null)

    try {
      const url = `/api/metrics/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '导出失败')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      
      let filename = `运营指标_${startDate}_${endDate}.csv`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/i)
        if (match) {
          filename = decodeURIComponent(match[1])
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导出失败'
      setError(errorMessage)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">
          当前范围：{dayCount} 天（最大 {MAX_EXPORT_DAYS} 天）
        </span>
        {isOverLimit && (
          <span className="text-xs font-medium text-red-600">
            ⚠ 超出导出上限
          </span>
        )}
      </div>
      
      <button
        onClick={handleExport}
        disabled={isOverLimit || exporting || disabled}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          isOverLimit || exporting || disabled
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
        }`}
      >
        {exporting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            导出中...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            导出 CSV
          </>
        )}
      </button>
      
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
