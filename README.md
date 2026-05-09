# Test Dogfooding Monorepo

这是一个包含多个项目的单仓库（Monorepo）架构，用于测试和演示目的。

## 项目结构

```
.
├── packages/            # 项目目录
│   └── queue-system/    # 线下门店预约排队系统
├── test/                # 内部指标仪表板
├── test1/               # Webhook 服务
├── README.md            # 本文件
└── .gitignore           # Git忽略文件
```

## 项目说明

### queue-system
- **描述**: 线下门店预约排队系统后端
- **技术栈**: FastAPI + SQLAlchemy + SQLite
- **功能**: 门店管理、服务项管理、号段规则、取号、叫号、过号处理、队列统计
- **目录**: `packages/queue-system/`

### test (internal-metrics-dashboard)
- **描述**: 内部指标仪表板
- **技术栈**: Next.js + React + Tailwind CSS + Recharts
- **功能**: 指标展示、数据筛选、图表可视化、数据导出
- **目录**: `test/`

### test1 (webhook-service)
- **描述**: Webhook 服务
- **技术栈**: TypeScript + Fastify + Prisma + SQLite
- **功能**: Webhook 接收、事件处理、队列管理
- **目录**: `test1/`

## 快速开始

### 克隆仓库

```bash
git clone https://github.com/xiaoyu-li-china/test_dogfooding.git
cd test_dogfooding
```

### 运行 queue-system 项目

```bash
cd packages/queue-system
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务将在 http://localhost:8000 运行

### 运行 test (internal-metrics-dashboard) 项目

```bash
cd test
npm install
npm run dev
```

服务将在 http://localhost:3000 运行

### 运行 test1 (webhook-service) 项目

```bash
cd test1
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## 扩展指南

1. **添加新项目**：创建新的项目文件夹
2. **遵循相同结构**：每个项目应包含自己的配置文件
3. **独立部署**：每个项目可以独立部署和运行

## 许可证

MIT License
