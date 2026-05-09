'use client'

import { DataSource } from '@/types'

interface DataSourceToggleProps {
  dataSource: DataSource
  onToggle: (source: DataSource) => void
}

export function DataSourceToggle({ dataSource, onToggle }: DataSourceToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">数据源:</span>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onToggle('mock')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              dataSource === 'mock'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Mock 数据
          </button>
          <button
            onClick={() => onToggle('live')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              dataSource === 'live'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Live API
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {dataSource === 'mock' 
          ? '当前使用本地生成的模拟数据（即时生成，无需网络请求）' 
          : '当前使用内嵌 Route Handler API（模拟生产环境数据获取）'
        }
      </p>
    </div>
  )
}
