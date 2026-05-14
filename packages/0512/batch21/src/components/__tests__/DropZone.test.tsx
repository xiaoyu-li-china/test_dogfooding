import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DropZone } from '../DropZone'

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-preview-url'),
    revokeObjectURL: vi.fn(),
  },
})

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('DropZone', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  const createFile = (name: string, type = 'text/plain', size = 1024) => {
    const content = new ArrayBuffer(size)
    return new File([content], name, { type })
  }

  it('renders correctly', () => {
    render(<DropZone />)
    expect(screen.getByText('拖拽文件到此处')).toBeInTheDocument()
    expect(screen.getByText('或点击选择文件')).toBeInTheDocument()
  })

  it('handles file selection via click', async () => {
    render(<DropZone />)
    const file = createFile('test.txt')

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })
  })

  it('handles multiple file selection', async () => {
    render(<DropZone />)
    const files = [createFile('test1.txt'), createFile('test2.txt')]

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files } })

    await waitFor(() => {
      expect(screen.getByText('test1.txt')).toBeInTheDocument()
      expect(screen.getByText('test2.txt')).toBeInTheDocument()
    })
  })

  it('creates preview for image files', async () => {
    render(<DropZone />)
    const file = createFile('test.jpg', 'image/jpeg')

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it('handles drag and drop', async () => {
    render(<DropZone />)
    const file = createFile('dropped.txt')
    const dropZone = screen.getByText('拖拽文件到此处').closest('[class*="border-dashed"]')!

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText('dropped.txt')).toBeInTheDocument()
    })
  })

  it('removes file from list', async () => {
    render(<DropZone />)
    const file = createFile('remove-me.txt')

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('remove-me.txt')).toBeInTheDocument()
    })

    const removeButton = screen.getByLabelText('移除文件')
    fireEvent.click(removeButton)

    expect(screen.queryByText('remove-me.txt')).not.toBeInTheDocument()
  })

  it('shows upload button for pending files', async () => {
    render(<DropZone />)
    const file = createFile('pending.txt')

    expect(screen.queryByText('开始上传')).not.toBeInTheDocument()

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('开始上传')).toBeInTheDocument()
      expect(screen.getByText('等待上传')).toBeInTheDocument()
    })
  })

  it('calculates chunks correctly', async () => {
    render(<DropZone />)
    const file = createFile('large-file.bin', 'application/octet-stream', 3 * 1024 * 1024)

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('共 3 分片')).toBeInTheDocument()
    })
  })

  it('shows batch control buttons when files are added', async () => {
    render(<DropZone />)
    const file = createFile('batch-test.txt')

    const input = screen.getByLabelText('选择文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('全部暂停')).toBeInTheDocument()
      expect(screen.getByText('全部取消')).toBeInTheDocument()
    })
  })
})
