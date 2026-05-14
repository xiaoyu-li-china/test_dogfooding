export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'success' | 'error' | 'cancelled'

export interface UploadFile {
  id: string
  name: string
  size: number
  file: File
  type: string
  status: UploadStatus
  progress: number
  preview?: string
  totalChunks?: number
  uploadedChunks?: number[]
  currentChunk?: number
}

export interface UseFileUploadOptions {
  concurrency?: number
  chunkSize?: number
}

export interface UseFileUploadReturn {
  files: UploadFile[]
  addFiles: (newFiles: File[]) => Promise<void>
  removeFile: (id: string) => void
  startUpload: () => void
  pauseUpload: (id: string) => void
  resumeUpload: (id: string) => void
  cancelUpload: (id: string) => void
  pauseAll: () => void
  resumeAll: () => void
  cancelAll: () => void
}
