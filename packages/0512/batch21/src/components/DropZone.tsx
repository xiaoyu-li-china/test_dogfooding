import { useRef } from 'react'
import { Upload, Plus, Pause, PlayCircle, XCircle } from 'lucide-react'
import { FileList } from './FileList'
import { useFileUpload } from '../hooks/useFileUpload'

export function DropZone() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    files,
    addFiles,
    removeFile,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    pauseAll,
    resumeAll,
    cancelAll,
  } = useFileUpload({ concurrency: 3 })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    e.target.value = ''
  }

  const hasPendingFiles = files.some((f) => f.status === 'pending')
  const hasActiveUploads = files.some((f) => f.status === 'uploading' || f.status === 'pending')
  const hasPausedUploads = files.some((f) => f.status === 'paused')

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className="relative border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-50 rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-label="选择文件"
        />
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <Plus className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-700">
          拖拽文件到此处
        </p>
        <p className="text-sm text-gray-500 mt-1">
          或点击选择文件
        </p>
        <p className="text-xs text-gray-400 mt-2">
          支持图片预览、分片上传（1MB）、断点续传、最多 3 个并发
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex justify-center gap-2">
          {hasPendingFiles && (
            <button
              onClick={startUpload}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              开始上传
            </button>
          )}
          {hasActiveUploads && (
            <button
              onClick={pauseAll}
              className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              全部暂停
            </button>
          )}
          {hasPausedUploads && (
            <button
              onClick={resumeAll}
              className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              全部恢复
            </button>
          )}
          {(hasActiveUploads || hasPausedUploads) && (
            <button
              onClick={cancelAll}
              className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              全部取消
            </button>
          )}
        </div>
      )}

      <FileList
        files={files}
        onRemove={removeFile}
        onPause={pauseUpload}
        onResume={resumeUpload}
        onCancel={cancelUpload}
      />
    </div>
  )
}
