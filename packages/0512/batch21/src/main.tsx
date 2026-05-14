import React from 'react'
import ReactDOM from 'react-dom/client'
import { DropZone } from './components/DropZone'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">
        文件上传
      </h1>
      <DropZone />
    </div>
  </React.StrictMode>,
)