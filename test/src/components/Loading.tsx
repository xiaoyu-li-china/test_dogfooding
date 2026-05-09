'use client'

export function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">数据加载中...</p>
    </div>
  )
}
