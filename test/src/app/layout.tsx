import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '内部运营指标看板',
  description: '内部运营指标监控与分析平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
