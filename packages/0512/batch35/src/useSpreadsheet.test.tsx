import { renderHook, act } from '@testing-library/react'
import useSpreadsheet from './useSpreadsheet'

describe('useSpreadsheet', () => {
  const initialData = [
    ['姓名', '年龄', '城市'],
    ['张三', '28', '北京'],
    ['李四', '32', '上海'],
  ]

  it('应该初始化正确的状态', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    expect(result.current.data).toEqual(initialData)
    expect(result.current.rowCount).toBe(3)
    expect(result.current.colCount).toBe(3)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('应该能够设置单元格值', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.setCellValue(1, 0, '张三丰')
    })

    expect(result.current.data[1][0]).toBe('张三丰')
    expect(result.current.canUndo).toBe(true)
  })

  it('应该能够撤销操作', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.setCellValue(1, 0, '张三丰')
    })

    expect(result.current.data[1][0]).toBe('张三丰')

    act(() => {
      result.current.undo()
    })

    expect(result.current.data[1][0]).toBe('张三')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('应该能够重做操作', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.setCellValue(1, 0, '张三丰')
    })

    act(() => {
      result.current.undo()
    })

    expect(result.current.data[1][0]).toBe('张三')

    act(() => {
      result.current.redo()
    })

    expect(result.current.data[1][0]).toBe('张三丰')
    expect(result.current.canRedo).toBe(false)
  })

  it('应该能够添加行', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.addRow(2)
    })

    expect(result.current.rowCount).toBe(4)
    expect(result.current.data[3]).toEqual(['', '', ''])
    expect(result.current.canUndo).toBe(true)
  })

  it('应该能够删除行', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.deleteRow(1)
    })

    expect(result.current.rowCount).toBe(2)
    expect(result.current.data[1][0]).toBe('李四')
  })

  it('不应该删除最后一行', () => {
    const singleRowData = [['姓名', '年龄', '城市']]
    const { result } = renderHook(() => useSpreadsheet(singleRowData))

    act(() => {
      result.current.deleteRow(0)
    })

    expect(result.current.rowCount).toBe(1)
  })

  it('应该能够添加列', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.addColumn(2)
    })

    expect(result.current.colCount).toBe(4)
    result.current.data.forEach((row) => {
      expect(row[3]).toBe('')
    })
  })

  it('应该能够删除列', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.deleteColumn(2)
    })

    expect(result.current.colCount).toBe(2)
  })

  it('不应该删除最后一列', () => {
    const singleColData = [['姓名'], ['张三'], ['李四']]
    const { result } = renderHook(() => useSpreadsheet(singleColData))

    act(() => {
      result.current.deleteColumn(0)
    })

    expect(result.current.colCount).toBe(1)
  })

  it('应该能够排序', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.handleSort(1)
    })

    expect(result.current.sortConfig).toEqual({ col: 1, direction: 'asc' })
  })

  it('应该能够切换排序方向', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.handleSort(1)
    })

    expect(result.current.sortConfig).toEqual({ col: 1, direction: 'asc' })

    act(() => {
      result.current.handleSort(1)
    })

    expect(result.current.sortConfig).toEqual({ col: 1, direction: 'desc' })
  })

  it('应该能够取消排序', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.handleSort(1)
    })

    act(() => {
      result.current.handleSort(1)
    })

    act(() => {
      result.current.handleSort(1)
    })

    expect(result.current.sortConfig).toBeNull()
  })

  it('应该能够筛选', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.setFilter(0, '张')
    })

    expect(result.current.filterConfig[0]).toBe('张')
    expect(result.current.visibleRowCount).toBeLessThan(3)
  })

  it('应该能够清除筛选', () => {
    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.setFilter(0, '张')
    })

    act(() => {
      result.current.setFilter(0, '')
    })

    expect(result.current.filterConfig[0]).toBeUndefined()
  })

  it('应该能够正确计算公式', () => {
    const formulaData = [
      ['数值1', '数值2', '总和'],
      ['10', '20', '=SUM(A2:B2)'],
      ['30', '40', '=AVERAGE(A2:A3)'],
    ]

    const { result } = renderHook(() => useSpreadsheet(formulaData))

    expect(result.current.computedData[1][2]).toBe('30')
    expect(result.current.computedData[2][2]).toBe('20.00')
  })

  it('应该能够识别公式单元格', () => {
    const formulaData = [
      ['数值1', '数值2', '总和'],
      ['10', '20', '=SUM(A2:B2)'],
    ]

    const { result } = renderHook(() => useSpreadsheet(formulaData))

    expect(result.current.isFormulaCell(1, 2)).toBe(true)
    expect(result.current.isFormulaCell(1, 0)).toBe(false)
  })

  it('应该能够重置数据', () => {
    const newData = [
      ['新数据1', '新数据2'],
      ['值1', '值2'],
    ]

    const { result } = renderHook(() => useSpreadsheet(initialData))

    act(() => {
      result.current.reset(newData)
    })

    expect(result.current.data).toEqual(newData)
    expect(result.current.canUndo).toBe(false)
  })
})
