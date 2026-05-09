# 内部运营指标看板

一个基于 **Next.js (App Router) + TypeScript** 的内部运营指标监控看板，支持日期筛选、数据表格、趋势图表，并可在 Mock 数据和 Live API 两种数据源之间切换。

## 技术栈

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (样式框架)
- **Recharts** (图表库)

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── metrics/
│   │       └── route.ts       # Route Handler API（内存数据源）
│   ├── globals.css            # 全局样式
│   ├── layout.tsx             # 根布局
│   └── page.tsx               # 主页面
├── components/
│   ├── DateFilter.tsx         # 日期筛选组件
│   ├── DataSourceToggle.tsx   # 数据源切换开关
│   ├── SummaryCards.tsx       # 指标汇总卡片
│   ├── MetricsChart.tsx       # 折线图组件
│   ├── MetricsTable.tsx       # 数据表格组件
│   ├── Loading.tsx            # 加载状态组件
│   └── Error.tsx              # 错误状态组件
├── hooks/
│   └── useMetrics.ts          # 数据获取 Hook
├── data/
│   └── mockData.ts            # Mock 数据生成器
└── types/
    └── index.ts               # TypeScript 类型定义
```

## 数据源说明

本项目使用 **内存数据源** 动态生成指标数据，无需数据库配置。每次请求都会基于日期范围生成新的随机数据。

### Mock 数据模式
- 客户端直接调用本地的 mock 数据生成函数
- 数据即时生成，无需网络请求
- 适合开发和调试使用

### Live API 模式
- 通过 Next.js 的 **Route Handler** 提供 JSON API
- API 端点：`GET /api/metrics`
- 查询参数：
  - `startDate` (必需): 开始日期，格式 YYYY-MM-DD
  - `endDate` (必需): 结束日期，格式 YYYY-MM-DD
- 限制：日期范围最大 90 天

**API 响应示例：**
```json
{
  "data": [
    {
      "date": "2024-01-01",
      "pv": 12500,
      "uv": 4200,
      "orders": 280,
      "revenue": 33600,
      "conversionRate": 0.0667,
      "avgOrderValue": 120.00
    }
  ],
  "summary": {
    "totalPv": 12500,
    "totalUv": 4200,
    "totalOrders": 280,
    "totalRevenue": 33600,
    "avgConversionRate": 0.0667,
    "avgOrderValue": 120.00
  }
}
```

## 安装与启动

### 前置要求

- Node.js 18.x 或更高版本
- npm 或 pnpm 或 yarn

### 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 开发模式

```bash
npm run dev
# 或
pnpm dev
# 或
yarn dev
```

项目将在 `http://localhost:3000` 启动。

### 构建生产版本

```bash
npm run build
# 或
pnpm build
# 或
yarn build
```

### 启动生产服务器

```bash
npm start
# 或
pnpm start
# 或
yarn start
```

## 功能特性

### 1. 日期筛选
- 快速选择：最近 7 天、最近 14 天、最近 30 天
- 自定义日期范围选择器
- 支持手动输入开始/结束日期

### 2. 指标展示
- **汇总卡片**：总 PV、总 UV、总订单数、总销售额、平均转化率、平均客单价
- **折线图**：PV、UV、订单数、销售额的趋势变化
- **数据表格**：每日详细指标数据

### 3. 数据源切换
- **Mock 数据**：客户端本地生成数据，响应速度快
- **Live API**：通过 Route Handler 获取数据，模拟真实 API 调用

### 4. 用户体验
- 加载状态动画
- 错误状态展示和重试功能
- 响应式设计，支持移动端和桌面端
- 数据格式化（数字、百分比、货币）

## 开发说明

### 添加新指标
1. 在 `src/types/index.ts` 中扩展 `DailyMetrics` 接口
2. 更新 `src/data/mockData.ts` 中的数据生成逻辑
3. 在 `src/components/MetricsTable.tsx` 和 `src/components/MetricsChart.tsx` 中添加新指标的展示

### 修改 API 逻辑
编辑 `src/app/api/metrics/route.ts` 来修改 API 行为。

### 切换到 SQLite
如需使用 SQLite 替代内存数据源：

1. 安装依赖：
```bash
npm install better-sqlite3
```

2. 修改 `src/app/api/metrics/route.ts` 中的数据获取逻辑
3. 参考 better-sqlite3 文档创建数据库和表

## 许可证

MIT License
