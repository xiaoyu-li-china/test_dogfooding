import { useState } from 'react'
import EditableTable from './EditableTable'
import './App.css'

function App() {
  const initialData = [
    ['姓名', '年龄', '城市', '薪资', '评分'],
    ['张三', '28', '北京', '15000', '4.5'],
    ['李四', '32', '上海', '18000', '4.8'],
    ['王五', '25', '广州', '12000', '4.2'],
    ['赵六', '35', '深圳', '20000', '4.9'],
    ['钱七', '29', '杭州', '16000', '4.6'],
    ['总计', '=AVERAGE(B2:B6)', '', '=SUM(D2:D6)', '=AVERAGE(E2:E6)'],
  ]

  const [tableData, setTableData] = useState<string[][]>(initialData)

  return (
    <div className="app">
      <h1>可编辑表格组件</h1>
      <p className="description">
        双击编辑 | Tab/Enter 导航 | 点击表头排序 | 筛选框输入筛选 | 公式自动计算
      </p>
      <EditableTable data={tableData} onChange={setTableData} />
      <div className="features">
        <h3>功能特性：</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>📝 编辑功能</h4>
            <ul>
              <li>双击单元格进入编辑模式</li>
              <li>Tab 键向右移动焦点</li>
              <li>Enter 键向下移动焦点</li>
              <li>Shift+Tab / Shift+Enter 反向移动</li>
              <li>ESC 取消编辑</li>
            </ul>
          </div>
          <div className="feature-card">
            <h4>📊 行列操作</h4>
            <ul>
              <li>在任意位置插入/删除行</li>
              <li>在任意位置插入/删除列</li>
              <li>操作按钮悬停显示</li>
            </ul>
          </div>
          <div className="feature-card">
            <h4>🔄 排序筛选</h4>
            <ul>
              <li>点击列标题排序（升序/降序）</li>
              <li>数字和文本智能排序</li>
              <li>每列独立输入框筛选</li>
              <li>一键清除排序和筛选</li>
            </ul>
          </div>
          <div className="feature-card">
            <h4>🧮 公式计算</h4>
            <ul>
              <li>=SUM(A1:A5) - 求和</li>
              <li>=AVERAGE(B1:B5) - 平均值</li>
              <li>=COUNT(C1:C5) - 计数</li>
              <li>=MAX/=MIN - 最大/最小值</li>
              <li>公式单元格只读，显示 fx 标记</li>
              <li>悬停显示原始公式</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
