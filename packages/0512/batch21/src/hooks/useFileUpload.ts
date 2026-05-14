import { useState, useCallback, useRef, useEffect } from 'react'
import type { UploadFile, UseFileUploadOptions, UseFileUploadReturn } from '../types'
import {
  createChunks,
  mockChunkUpload,
  getUploadedChunks,
  saveUploadedChunk,
  clearUploadedChunks
} from '../utils/chunkUpload'

const generateId = () => Math.random().toString(36).substring(2, 9)

const DEFAULT_CONCURRENCY = 3
const DEFAULT_CHUNK_SIZE = 1024 * 1024

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    chunkSize = DEFAULT_CHUNK_SIZE,
  } = options

  const [files, setFiles] = useState<UploadFile[]>([])
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map())
  const activeUploadsCount = useRef(0)
  const isProcessing = useRef(false)

  const processFile = useCallback(async (file: File): Promise<UploadFile> => {
    let preview: string | undefined
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file)
    }

    const chunks = createChunks(file, chunkSize)
    const totalChunks = chunks.length
    const uploadedChunks = await getUploadedChunks(file)

    return {
      id: generateId(),
      name: file.name,
      size: file.size,
      file,
      type: file.type,
      status: 'pending',
      progress: uploadedChunks.length > 0 ? Math.round((uploadedChunks.length / totalChunks) * 100) : 0,
      preview,
      totalChunks,
      uploadedChunks,
      currentChunk: uploadedChunks.length,
    }
  }, [chunkSize])

  const addFiles = useCallback(async (newFiles: File[]) => {
    const uploadFiles = await Promise.all(newFiles.map(processFile))
    setFiles((prev) => [...prev, ...uploadFiles])
  }, [processFile])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      const controller = uploadAbortControllers.current.get(id)
      if (controller) {
        controller.abort()
        uploadAbortControllers.current.delete(id)
      }
      return prev.filter((file) => file.id !== id)
    })
  }, [])

  const processQueue = useCallback(async () => {
    if (isProcessing.current) return
    isProcessing.current = true

    const processNext = async () => {
      if (activeUploadsCount.current >= concurrency) return

      const nextFile = files.find((f) => f.status === 'pending')
      if (!nextFile) {
        isProcessing.current = false
        return
      }

      activeUploadsCount.current++

      const controller = new AbortController()
      uploadAbortControllers.current.set(nextFile.id, controller)

      setFiles((prev) =>
        prev.map((f) =>
          f.id === nextFile.id ? { ...f, status: 'uploading' } : f
        )
      )

      try {
        const chunks = createChunks(nextFile.file, chunkSize)
        const uploadedChunks = nextFile.uploadedChunks || []

        for (let i = 0; i < chunks.length; i++) {
          if (uploadedChunks.includes(i)) continue

          const currentFile = files.find((f) => f.id === nextFile.id)
          if (currentFile?.status === 'paused' || currentFile?.status === 'cancelled') {
            break
          }

          if (controller.signal.aborted) {
            break
          }

          await mockChunkUpload(chunks[i], i, nextFile.file)
          await saveUploadedChunk(nextFile.file, i)

          const newUploadedChunks = [...uploadedChunks, i]
          const progress = Math.round((newUploadedChunks.length / chunks.length) * 100)

          setFiles((prev) =>
            prev.map((f) =>
              f.id === nextFile.id
                ? { ...f, progress, uploadedChunks: newUploadedChunks, currentChunk: i + 1 }
                : f
            )
          )
        }

        const finalFile = files.find((f) => f.id === nextFile.id)
        if (finalFile?.status !== 'paused' && finalFile?.status !== 'cancelled') {
          await clearUploadedChunks(nextFile.file)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === nextFile.id ? { ...f, status: 'success' } : f
            )
          )
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === nextFile.id ? { ...f, status: 'error' } : f
          )
        )
      } finally {
        uploadAbortControllers.current.delete(nextFile.id)
        activeUploadsCount.current--
        processNext()
      }
    }

    for (let i = 0; i < concurrency; i++) {
      processNext()
    }
  }, [files, concurrency, chunkSize])

  const startUpload = useCallback(() => {
    processQueue()
  }, [processQueue])

  const pauseUpload = useCallback((id: string) => {
    const controller = uploadAbortControllers.current.get(id)
    if (controller) {
      controller.abort()
      uploadAbortControllers.current.delete(id)
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'paused' } : f
      )
    )
  }, [])

  const resumeUpload = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'pending' } : f
      )
    )
    setTimeout(() => processQueue(), 0)
  }, [processQueue])

  const cancelUpload = useCallback((id: string) => {
    const controller = uploadAbortControllers.current.get(id)
    if (controller) {
      controller.abort()
      uploadAbortControllers.current.delete(id)
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'cancelled', progress: 0 } : f
      )
    )
  }, [])

  const pauseAll = useCallback(() => {
    files.forEach((file) => {
      if (file.status === 'uploading' || file.status === 'pending') {
        pauseUpload(file.id)
      }
    })
  }, [files, pauseUpload])

  const resumeAll = useCallback(() => {
    files.forEach((file) => {
      if (file.status === 'paused') {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: 'pending' } : f
          )
        )
      }
    })
    setTimeout(() => processQueue(), 0)
  }, [files, processQueue])

  const cancelAll = useCallback(() => {
    files.forEach((file) => {
      if (file.status === 'uploading' || file.status === 'pending' || file.status === 'paused') {
        cancelUpload(file.id)
      }
    })
  }, [files, cancelUpload])

  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })
      uploadAbortControllers.current.forEach((controller) => controller.abort())
    }
  }, [files])

  return {
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
  }
}
