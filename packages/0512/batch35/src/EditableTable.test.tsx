import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableTable from './EditableTable'

describe('EditableTable', () => {
  const mockData = [
    ['姓名', '年龄', '城市'],
    ['张三', '28', '北京'],
    ['李四', '32', '上海'],
  ]

  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  const getCellInput = () => {
    return screen.getAllByRole('textbox').find(
      (input) => input.classList.contains('cell-input')
    )
  }

  describe('编辑保存功能', () => {
    it('双击单元格进入编辑模式', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('张三')
    })

    it('编辑后失去焦点保存数据', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        fireEvent.blur(input)
      }
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('ESC键取消编辑', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        await userEvent.keyboard('{Escape}')
      }
      
      await waitFor(() => {
        expect(getCellInput()).toBeUndefined()
      })
    })
  })

  describe('新增行列功能', () => {
    it('点击添加行按钮新增一行', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const addRowBtn = screen.getByText('+ 添加行')
      await userEvent.click(addRowBtn)
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('点击添加列按钮新增一列', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const addColBtn = screen.getByText('+ 添加列')
      await userEvent.click(addColBtn)
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe('键盘导航功能', () => {
    it('Tab键触发保存', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        await userEvent.keyboard('{Tab}')
      }
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('Enter键触发保存', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        await userEvent.keyboard('{Enter}')
      }
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe('公式计算功能', () => {
    const formulaData = [
      ['数值1', '数值2', '总和'],
      ['10', '20', '=SUM(A2:B2)'],
      ['35', '45', '=AVERAGE(A2:A3)'],
    ]

    it('显示SUM公式计算结果', () => {
      render(<EditableTable data={formulaData} onChange={mockOnChange} />)
      expect(screen.getByText('30')).toBeInTheDocument()
    })

    it('显示AVERAGE公式计算结果', () => {
      render(<EditableTable data={formulaData} onChange={mockOnChange} />)
      expect(screen.getByText('22.50')).toBeInTheDocument()
    })

    it('公式单元格显示fx标记', () => {
      render(<EditableTable data={formulaData} onChange={mockOnChange} />)
      const formulaBadges = screen.getAllByText('fx')
      expect(formulaBadges.length).toBeGreaterThan(0)
    })
  })

  describe('筛选功能', () => {
    it('在筛选输入框中输入进行筛选', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const filterInputs = screen.getAllByPlaceholderText('筛选...')
      await userEvent.type(filterInputs[0], '张')
      
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.queryByText('李四')).not.toBeInTheDocument()
      })
    })
  })

  describe('撤销重做功能', () => {
    it('初始状态下撤销按钮应该禁用', () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const buttons = screen.getAllByRole('button')
      const undoBtn = buttons.find((btn) => btn.textContent?.includes('↶ 撤销'))
      expect(undoBtn).toBeDisabled()
    })

    it('编辑后撤销按钮应该可用', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        fireEvent.blur(input)
      }
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        const undoBtn = buttons.find((btn) => btn.textContent?.includes('↶ 撤销'))
        expect(undoBtn).not.toBeDisabled()
      })
    })

    it('点击撤销按钮应该撤销上一步操作', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        fireEvent.blur(input)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三丰')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      const undoBtn = buttons.find((btn) => btn.textContent?.includes('↶ 撤销'))
      if (undoBtn) {
        await userEvent.click(undoBtn)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })
    })

    it('撤销后重做按钮应该可用', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        fireEvent.blur(input)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三丰')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      const undoBtn = buttons.find((btn) => btn.textContent?.includes('↶ 撤销'))
      if (undoBtn) {
        await userEvent.click(undoBtn)
      }
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        const redoBtn = buttons.find((btn) => btn.textContent?.includes('↷ 重做'))
        expect(redoBtn).not.toBeDisabled()
      })
    })

    it('点击重做按钮应该重做已撤销的操作', async () => {
      render(<EditableTable data={mockData} onChange={mockOnChange} />)
      
      const cell = screen.getByText('张三')
      await userEvent.dblClick(cell)
      
      const input = getCellInput()
      if (input) {
        await userEvent.clear(input)
        await userEvent.type(input, '张三丰')
        fireEvent.blur(input)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三丰')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      const undoBtn = buttons.find((btn) => btn.textContent?.includes('↶ 撤销'))
      if (undoBtn) {
        await userEvent.click(undoBtn)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })
      
      const buttonsAfterUndo = screen.getAllByRole('button')
      const redoBtn = buttonsAfterUndo.find((btn) => btn.textContent?.includes('↷ 重做'))
      if (redoBtn) {
        await userEvent.click(redoBtn)
      }
      
      await waitFor(() => {
        expect(screen.getByText('张三丰')).toBeInTheDocument()
      })
    })
  })
})
