const DEFAULT_CHUNK_SIZE = 1024 * 1024

const getFileHash = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const hash = btoa(encodeURIComponent(file.name + file.size + content.slice(0, 100)))
      resolve(hash)
    }
    reader.readAsArrayBuffer(file.slice(0, 100))
  })
}

export const getUploadedChunks = async (file: File): Promise<number[]> => {
  const hash = await getFileHash(file)
  const key = `upload_chunks_${hash}`
  const stored = localStorage.getItem(key)
  return stored ? JSON.parse(stored) : []
}

export const saveUploadedChunk = async (file: File, chunkIndex: number): Promise<void> => {
  const hash = await getFileHash(file)
  const key = `upload_chunks_${hash}`
  const chunks = await getUploadedChunks(file)
  if (!chunks.includes(chunkIndex)) {
    chunks.push(chunkIndex)
    localStorage.setItem(key, JSON.stringify(chunks))
  }
}

export const clearUploadedChunks = async (file: File): Promise<void> => {
  const hash = await getFileHash(file)
  const key = `upload_chunks_${hash}`
  localStorage.removeItem(key)
}

export const createChunks = (file: File, chunkSize: number = DEFAULT_CHUNK_SIZE): Blob[] => {
  const chunks: Blob[] = []
  let start = 0
  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size)
    chunks.push(file.slice(start, end))
    start = end
  }
  return chunks
}

export const mockChunkUpload = async (
  _chunk: Blob,
  _chunkIndex: number,
  _file: File
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200))
}
