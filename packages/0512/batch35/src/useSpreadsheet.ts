import { useReducer, useCallback, useMemo } from 'react'

// ============ Types ============

export interface CellPosition {
  row: number
  col: number
}

export interface SortConfig {
  col: number
  direction: 'asc' | 'desc'
}

export interface FilterConfig {
  [col: number]: string
}

export interface SpreadsheetState {
  data: string[][]
  sortConfig: SortConfig | null
  filterConfig: FilterConfig
}

export interface HistoryState {
  past: SpreadsheetState[]
  present: SpreadsheetState
  future: SpreadsheetState[]
}

export type Action =
  | { type: 'SET_CELL_VALUE'; payload: { row: number; col: number; value: string } }
  | { type: 'ADD_ROW'; payload: { index: number } }
  | { type: 'DELETE_ROW'; payload: { index: number } }
  | { type: 'ADD_COLUMN'; payload: { index: number } }
  | { type: 'DELETE_COLUMN'; payload: { index: number } }
  | { type: 'SET_SORT_CONFIG'; payload: SortConfig | null }
  | { type: 'SET_FILTER_CONFIG'; payload: { col: number; value: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; payload: string[][] }

// ============ Formula Calculation ============

const parseCellRef = (ref: string): CellPosition | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  const col = match[1].toUpperCase().split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1
  const row = parseInt(match[2]) - 1
  return { row, col }
}

const parseRange = (range: string): { start: CellPosition; end: CellPosition } | null => {
  const parts = range.split(':')
  if (parts.length !== 2) return null
  const start = parseCellRef(parts[0])
  const end = parseCellRef(parts[1])
  if (!start || !end) return null
  return { start, end }
}

export const evaluateFormula = (formula: string, data: string[][]): string => {
  const upperFormula = formula.toUpperCase().trim()

  const sumMatch = upperFormula.match(/^=SUM\(([^)]+)\)$/i)
  if (sumMatch) {
    const range = parseRange(sumMatch[1])
    if (range) {
      let sum = 0
      for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
        for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
          if (data[r] && data[r][c]) {
            const val = parseFloat(data[r][c])
            if (!isNaN(val)) sum += val
          }
        }
      }
      return sum.toString()
    }
  }

  const avgMatch = upperFormula.match(/^=AVERAGE\(([^)]+)\)$/i)
  if (avgMatch) {
    const range = parseRange(avgMatch[1])
    if (range) {
      let sum = 0
      let count = 0
      for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
        for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
          if (data[r] && data[r][c]) {
            const val = parseFloat(data[r][c])
            if (!isNaN(val)) {
              sum += val
              count++
            }
          }
        }
      }
      return count > 0 ? (sum / count).toFixed(2) : '0'
    }
  }

  const countMatch = upperFormula.match(/^=COUNT\(([^)]+)\)$/i)
  if (countMatch) {
    const range = parseRange(countMatch[1])
    if (range) {
      let count = 0
      for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
        for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
          if (data[r] && data[r][c] && data[r][c].trim() !== '') {
            count++
          }
        }
      }
      return count.toString()
    }
  }

  const maxMatch = upperFormula.match(/^=MAX\(([^)]+)\)$/i)
  if (maxMatch) {
    const range = parseRange(maxMatch[1])
    if (range) {
      let max = -Infinity
      for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
        for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
          if (data[r] && data[r][c]) {
            const val = parseFloat(data[r][c])
            if (!isNaN(val)) max = Math.max(max, val)
          }
        }
      }
      return max === -Infinity ? '0' : max.toString()
    }
  }

  const minMatch = upperFormula.match(/^=MIN\(([^)]+)\)$/i)
  if (minMatch) {
    const range = parseRange(minMatch[1])
    if (range) {
      let min = Infinity
      for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
        for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
          if (data[r] && data[r][c]) {
            const val = parseFloat(data[r][c])
            if (!isNaN(val)) min = Math.min(min, val)
          }
        }
      }
      return min === Infinity ? '0' : min.toString()
    }
  }

  return '#ERROR'
}

// ============ Reducer ============

const createInitialState = (data: string[][]): HistoryState => ({
  past: [],
  present: {
    data,
    sortConfig: null,
    filterConfig: {},
  },
  future: [],
})

const cloneState = (state: SpreadsheetState): SpreadsheetState => ({
  data: state.data.map(row => [...row]),
  sortConfig: state.sortConfig,
  filterConfig: { ...state.filterConfig },
})

const spreadsheetReducer = (state: HistoryState, action: Action): HistoryState => {
  const { past, present, future } = state

  switch (action.type) {
    case 'SET_CELL_VALUE': {
      const { row, col, value } = action.payload
      const newData = present.data.map((r, rIdx) =>
        r.map((c, cIdx) => (rIdx === row && cIdx === col ? value : c))
      )
      return {
        past: [...past, cloneState(present)],
        present: { ...present, data: newData },
        future: [],
      }
    }

    case 'ADD_ROW': {
      const { index } = action.payload
      const colCount = present.data[0]?.length || 0
      const newRow = Array(colCount).fill('')
      const newData = [...present.data]
      newData.splice(index + 1, 0, newRow)
      return {
        past: [...past, cloneState(present)],
        present: { ...present, data: newData },
        future: [],
      }
    }

    case 'DELETE_ROW': {
      const { index } = action.payload
      if (present.data.length <= 1) return state
      const newData = present.data.filter((_, idx) => idx !== index)
      return {
        past: [...past, cloneState(present)],
        present: { ...present, data: newData },
        future: [],
      }
    }

    case 'ADD_COLUMN': {
      const { index } = action.payload
      const newData = present.data.map((row) => {
        const newRow = [...row]
        newRow.splice(index + 1, 0, '')
        return newRow
      })
      return {
        past: [...past, cloneState(present)],
        present: { ...present, data: newData },
        future: [],
      }
    }

    case 'DELETE_COLUMN': {
      const { index } = action.payload
      const colCount = present.data[0]?.length || 0
      if (colCount <= 1) return state
      const newData = present.data.map((row) => row.filter((_, idx) => idx !== index))
      return {
        past: [...past, cloneState(present)],
        present: { ...present, data: newData },
        future: [],
      }
    }

    case 'SET_SORT_CONFIG': {
      return {
        past: [...past, cloneState(present)],
        present: { ...present, sortConfig: action.payload },
        future: [],
      }
    }

    case 'SET_FILTER_CONFIG': {
      const { col, value } = action.payload
      const newFilterConfig = { ...present.filterConfig }
      if (value) {
        newFilterConfig[col] = value
      } else {
        delete newFilterConfig[col]
      }
      return {
        ...state,
        present: { ...present, filterConfig: newFilterConfig },
      }
    }

    case 'UNDO': {
      if (past.length === 0) return state
      const previous = past[past.length - 1]
      const newPast = past.slice(0, past.length - 1)
      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      }
    }

    case 'REDO': {
      if (future.length === 0) return state
      const next = future[0]
      const newFuture = future.slice(1)
      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      }
    }

    case 'RESET': {
      return createInitialState(action.payload)
    }

    default:
      return state
  }
}

// ============ Hook ============

export const useSpreadsheet = (initialData: string[][], onChange?: (data: string[][]) => void) => {
  const [state, dispatch] = useReducer(spreadsheetReducer, initialData, createInitialState)

  const computedData = useMemo(() => {
    return state.present.data.map((row) =>
      row.map((cell) => {
        if (cell.startsWith('=')) {
          return evaluateFormula(cell, state.present.data)
        }
        return cell
      })
    )
  }, [state.present.data])

  const filteredAndSortedData = useMemo(() => {
    let result = computedData.map((row, idx) => ({ row, originalIdx: idx }))

    const filterConfig = state.present.filterConfig
    Object.keys(filterConfig).forEach((colStr) => {
      const col = parseInt(colStr)
      const filterValue = filterConfig[col].toLowerCase()
      if (filterValue) {
        result = result.filter(({ row }) => row[col]?.toLowerCase().includes(filterValue))
      }
    })

    const sortConfig = state.present.sortConfig
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a.row[sortConfig.col] || ''
        const valB = b.row[sortConfig.col] || ''
        const numA = parseFloat(valA)
        const numB = parseFloat(valB)

        let comparison: number
        if (!isNaN(numA) && !isNaN(numB)) {
          comparison = numA - numB
        } else {
          comparison = valA.localeCompare(valB)
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [computedData, state.present.sortConfig, state.present.filterConfig])

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    dispatch({ type: 'SET_CELL_VALUE', payload: { row, col, value } })
  }, [])

  const addRow = useCallback((index: number) => {
    dispatch({ type: 'ADD_ROW', payload: { index } })
  }, [])

  const deleteRow = useCallback((index: number) => {
    dispatch({ type: 'DELETE_ROW', payload: { index } })
  }, [])

  const addColumn = useCallback((index: number) => {
    dispatch({ type: 'ADD_COLUMN', payload: { index } })
  }, [])

  const deleteColumn = useCallback((index: number) => {
    dispatch({ type: 'DELETE_COLUMN', payload: { index } })
  }, [])

  const handleSort = useCallback((col: number) => {
    const currentSort = state.present.sortConfig
    if (currentSort?.col === col) {
      if (currentSort.direction === 'asc') {
        dispatch({ type: 'SET_SORT_CONFIG', payload: { col, direction: 'desc' } })
      } else {
        dispatch({ type: 'SET_SORT_CONFIG', payload: null })
      }
    } else {
      dispatch({ type: 'SET_SORT_CONFIG', payload: { col, direction: 'asc' } })
    }
  }, [state.present.sortConfig])

  const setFilter = useCallback((col: number, value: string) => {
    dispatch({ type: 'SET_FILTER_CONFIG', payload: { col, value } })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  const reset = useCallback((data: string[][]) => {
    dispatch({ type: 'RESET', payload: data })
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
  const rowCount = state.present.data.length
  const colCount = state.present.data[0]?.length || 0
  const visibleRowCount = filteredAndSortedData.length

  const isFormulaCell = useCallback(
    (row: number, col: number) => {
      return state.present.data[row]?.[col]?.startsWith('=')
    },
    [state.present.data]
  )

  const getCellDisplayValue = useCallback(
    (row: number, col: number) => {
      const filteredRow = filteredAndSortedData.find((r) => r.originalIdx === row)
      return filteredRow?.row[col] ?? ''
    },
    [filteredAndSortedData]
  )

  return {
    // State
    data: state.present.data,
    sortConfig: state.present.sortConfig,
    filterConfig: state.present.filterConfig,
    computedData,
    filteredAndSortedData,

    // Derived values
    canUndo,
    canRedo,
    rowCount,
    colCount,
    visibleRowCount,

    // Actions
    setCellValue,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    handleSort,
    setFilter,
    undo,
    redo,
    reset,

    // Helpers
    isFormulaCell,
    getCellDisplayValue,
    evaluateFormula,
  }
}

export default useSpreadsheet
