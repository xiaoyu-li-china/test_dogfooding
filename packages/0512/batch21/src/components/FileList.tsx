import { File, X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Pause, Play, XCircle } from 'lucide-react'
import type { UploadFile } from '../types'

interface FileListProps {
  files: UploadFile[]
  onRemove: (id: string) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getStatusIcon = (status: UploadFile['status']) => {
  switch (status) {
    case 'uploading':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />
    case 'paused':
      return <Pause className="w-5 h-5 text-yellow-500" />
    case 'cancelled':
      return <XCircle className="w-5 h-5 text-gray-400" />
    default:
      return <File className="w-5 h-5 text-gray-400" />
  }
}

const getStatusText = (status: UploadFile['status'], file: UploadFile) => {
  if (status === 'uploading' && file.totalChunks) {
    const uploaded = file.uploadedChunks?.length || 0
    return `上传中 ${uploaded}/${file.totalChunks} 分片`
  }
  switch (status) {
    case 'uploading':
      return '上传中'
    case 'success':
      return '上传成功'
    case 'error':
      return '上传失败'
    case 'paused':
      return '已暂停'
    case 'cancelled':
      return '已取消'
    default:
      return '等待上传'
  }
}

const canPause = (status: UploadFile['status']) => status === 'uploading' || status === 'pending'
const canResume = (status: UploadFile['status']) => status === 'paused'
const canCancel = (status: UploadFile['status']) => status === 'uploading' || status === 'pending' || status === 'paused'

export function FileList({ files, onRemove, onPause, onResume, onCancel }: FileListProps) {
  if (files.length === 0) return null

  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-medium text-gray-600">文件列表</h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : file.type?.startsWith('image/') ? (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              ) : (
                getStatusIcon(file.status)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {file.name}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </span>
                <span className={`text-xs ${
                  file.status === 'success' ? 'text-green-500' :
                  file.status === 'error' ? 'text-red-500' :
                  file.status === 'paused' ? 'text-yellow-500' :
                  file.status === 'cancelled' ? 'text-gray-500' :
                  'text-blue-500'
                }`}>
                  {getStatusText(file.status, file)}
                </span>
                {file.totalChunks && (file.status === 'pending' || file.status === 'paused') && (
                  <span className="text-xs text-purple-500">
                    共 {file.totalChunks} 分片
                    {file.uploadedChunks && file.uploadedChunks.length > 0 && 
                      ` (已传 ${file.uploadedChunks.length})`
                    }
                  </span>
                )}
              </div>
              {file.status === 'uploading' && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {file.progress}%
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {canPause(file.status) && onPause && (
                <button
                  onClick={() => onPause(file.id)}
                  className="p-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                  aria-label="暂停上传"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              {canResume(file.status) && onResume && (
                <button
                  onClick={() => onResume(file.id)}
                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  aria-label="恢复上传"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {canCancel(file.status) && onCancel && (
                <button
                  onClick={() => onCancel(file.id)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="取消上传"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onRemove(file.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="移除文件"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
