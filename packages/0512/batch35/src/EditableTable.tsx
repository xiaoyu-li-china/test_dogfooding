import React, { useState, useRef, useEffect, useCallback } from 'react'
import useSpreadsheet, { CellPosition } from './useSpreadsheet'
import './EditableTable.css'

interface EditableTableProps {
  data: string[][]
  onChange?: (data: string[][]) => void
}

const EditableTable: React.FC<EditableTableProps> = ({ data, onChange }) => {
  const spreadsheet = useSpreadsheet(data, onChange)
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  useEffect(() => {
    if (onChange) {
      onChange(spreadsheet.data)
    }
  }, [spreadsheet.data, onChange])

  const startEditing = useCallback((row: number, col: number) => {
    setEditingCell({ row, col })
    setEditValue(spreadsheet.data[row][col])
  }, [spreadsheet.data])

  const saveEdit = useCallback(() => {
    if (editingCell) {
      spreadsheet.setCellValue(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, spreadsheet])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  const moveFocus = useCallback(
    (currentRow: number, currentCol: number, direction: 'next' | 'prev' | 'down' | 'up') => {
      let newRow = currentRow
      let newCol = currentCol

      switch (direction) {
        case 'next':
          newCol = currentCol + 1
          if (newCol >= spreadsheet.colCount) {
            newCol = 0
            newRow = currentRow + 1
          }
          break
        case 'prev':
          newCol = currentCol - 1
          if (newCol < 0) {
            newCol = spreadsheet.colCount - 1
            newRow = currentRow - 1
          }
          break
        case 'down':
          newRow = currentRow + 1
          if (newRow >= spreadsheet.rowCount) {
            newRow = 0
            newCol = currentCol + 1
            if (newCol >= spreadsheet.colCount) {
              newCol = 0
            }
          }
          break
        case 'up':
          newRow = currentRow - 1
          if (newRow < 0) {
            newRow = spreadsheet.rowCount - 1
            newCol = currentCol - 1
            if (newCol < 0) {
              newCol = spreadsheet.colCount - 1
            }
          }
          break
      }

      if (newRow >= 0 && newRow < spreadsheet.rowCount && newCol >= 0 && newCol < spreadsheet.colCount) {
        spreadsheet.setCellValue(currentRow, currentCol, editValue)
        setEditingCell(null)
        setTimeout(() => {
          setEditingCell({ row: newRow, col: newCol })
          setEditValue(spreadsheet.data[newRow][newCol])
        }, 0)
      }
    },
    [spreadsheet, editValue]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      if (editingCell) {
        switch (e.key) {
          case 'Tab':
            e.preventDefault()
            e.stopPropagation()
            moveFocus(row, col, e.shiftKey ? 'prev' : 'next')
            break
          case 'Enter':
            e.preventDefault()
            e.stopPropagation()
            moveFocus(row, col, e.shiftKey ? 'up' : 'down')
            break
          case 'Escape':
            e.preventDefault()
            e.stopPropagation()
            cancelEdit()
            break
        }
      }
    },
    [editingCell, cancelEdit, moveFocus]
  )

  return (
    <div className="editable-table-container">
      <div className="table-controls">
        <button className="btn btn-primary" onClick={() => spreadsheet.addRow(spreadsheet.rowCount - 1)}>
          + 添加行
        </button>
        <button className="btn btn-primary" onClick={() => spreadsheet.addColumn(spreadsheet.colCount - 1)}>
          + 添加列
        </button>
        <button
          className={`btn btn-secondary ${!spreadsheet.canUndo ? 'btn-disabled' : ''}`}
          onClick={spreadsheet.undo}
          disabled={!spreadsheet.canUndo}
          title="Ctrl+Z"
        >
          ↶ 撤销
        </button>
        <button
          className={`btn btn-secondary ${!spreadsheet.canRedo ? 'btn-disabled' : ''}`}
          onClick={spreadsheet.redo}
          disabled={!spreadsheet.canRedo}
          title="Ctrl+Y"
        >
          ↷ 重做
        </button>
        {Object.keys(spreadsheet.filterConfig).length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              Object.keys(spreadsheet.filterConfig).forEach((col) => {
                spreadsheet.setFilter(parseInt(col), '')
              })
            }}
          >
            清除筛选
          </button>
        )}
        {spreadsheet.sortConfig && (
          <button className="btn btn-secondary" onClick={() => spreadsheet.handleSort(-1)}>
            清除排序
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="editable-table">
          <thead>
            <tr>
              <th className="corner-cell"></th>
              {data[0]?.map((_, colIdx) => (
                <th key={colIdx} className="col-header">
                  <div
                    className="col-header-content"
                    onClick={() => spreadsheet.handleSort(colIdx)}
                    title="点击排序"
                  >
                    <span className="col-letter">{String.fromCharCode(65 + colIdx)}</span>
                    <span className="sort-indicator">
                      {spreadsheet.sortConfig?.col !== colIdx
                        ? '↕'
                        : spreadsheet.sortConfig.direction === 'asc'
                        ? '↑'
                        : '↓'}
                    </span>
                  </div>
                  <div className="filter-input-wrapper">
                    <input
                      ref={inputRef}
                      type="text"
                      className="filter-input"
                      placeholder="筛选..."
                      value={spreadsheet.filterConfig[colIdx] || ''}
                      onChange={(e) => spreadsheet.setFilter(colIdx, e.target.value)}
                    />
                    {spreadsheet.filterConfig[colIdx] && (
                      <span className="filter-active">🔍</span>
                    )}
                  </div>
                  <div className="col-actions">
                    <button
                      className="btn-icon"
                      onClick={() => spreadsheet.addColumn(colIdx)}
                      title="在右侧插入列"
                    >
                      +
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => spreadsheet.deleteColumn(colIdx)}
                      title="删除此列"
                      disabled={spreadsheet.colCount <= 1}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spreadsheet.filteredAndSortedData.map(({ row, originalIdx }) => (
              <tr key={originalIdx}>
                <td className="row-header">
                  <span>{originalIdx + 1}</span>
                  <div className="row-actions">
                    <button
                      className="btn-icon"
                      onClick={() => spreadsheet.addRow(originalIdx)}
                      title="在下方插入行"
                    >
                      +
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => spreadsheet.deleteRow(originalIdx)}
                      title="删除此行"
                      disabled={spreadsheet.rowCount <= 1}
                    >
                      ×
                    </button>
                  </div>
                </td>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={`cell ${
                      editingCell?.row === originalIdx && editingCell?.col === colIdx
                        ? 'editing'
                        : ''
                    } ${spreadsheet.isFormulaCell(originalIdx, colIdx) ? 'formula-cell' : ''}`}
                    onDoubleClick={() => !spreadsheet.isFormulaCell(originalIdx, colIdx) && startEditing(originalIdx, colIdx)}
                    onKeyDown={(e) => handleKeyDown(e, originalIdx, colIdx)}
                    title={spreadsheet.isFormulaCell(originalIdx, colIdx) ? `公式: ${data[originalIdx][colIdx]}` : '双击编辑'}
                  >
                    {editingCell?.row === originalIdx && editingCell?.col === colIdx ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        className="cell-input"
                      />
                    ) : (
                      <span className="cell-content">
                        {spreadsheet.isFormulaCell(originalIdx, colIdx) && (
                          <span className="formula-badge">fx</span>
                        )}
                        {cell || '\u00A0'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="table-info">
          显示 {spreadsheet.visibleRowCount} / {spreadsheet.rowCount} 行 × {spreadsheet.colCount} 列
          {spreadsheet.canUndo && <span className="history-indicator"> 历史: {spreadsheet.canUndo ? '可撤销' : ''}{spreadsheet.canRedo ? ' | 可重做' : ''}</span>}
        </div>
        <div className="formula-help">
          公式支持: =SUM(A1:A3), =AVERAGE(B1:B5), =COUNT(C1:C10), =MAX, =MIN
        </div>
      </div>
    </div>
  )
}

export default EditableTable
