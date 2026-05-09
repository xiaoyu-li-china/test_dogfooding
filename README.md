# 线下门店预约排队系统后端

这是一个基于 FastAPI 和 SQLite 的线下门店预约排队系统后端，支持门店管理、服务项管理、号段规则、取号、叫号、过号和统计功能。

## 技术栈

- Python 3.9+
- FastAPI
- SQLAlchemy 2.x
- SQLite
- Pydantic V2

## 项目结构

```
.
├── api/              # API 路由
│   ├── __init__.py
│   ├── health.py     # 健康检查接口
│   ├── store.py      # 门店接口
│   ├── service.py    # 服务项接口
│   ├── queue_rules.py # 号段规则接口
│   └── queue.py      # 排队相关接口
├── services/         # 业务逻辑
│   ├── __init__.py
│   └── queue_service.py  # 排队服务
├── models/           # 数据模型
│   ├── __init__.py
│   ├── store.py      # 门店模型
│   ├── service.py    # 服务项模型
│   ├── queue_rule.py # 号段规则模型
│   └── queue_record.py # 排队记录模型
├── schemas/          # 数据验证模式
│   ├── __init__.py
│   ├── store.py      # 门店模式
│   ├── service.py    # 服务项模式
│   ├── queue_rule.py # 号段规则模式
│   └── queue_record.py # 排队记录模式
├── db/               # 数据库配置
│   ├── __init__.py
│   └── base.py       # 数据库基础配置
├── main.py           # 主应用文件
├── requirements.txt  # 依赖文件
├── Dockerfile        # Docker 构建文件
└── README.md         # 项目说明
```

## 安装

### 1. 克隆项目

```bash
git clone <项目地址>
cd <项目目录>
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

## 建表

项目启动时会自动创建数据库表结构，无需手动执行迁移命令。

## 启动服务

### 1. 开发模式启动

```bash
python main.py
```

### 2. 生产模式启动

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务启动后，可访问以下地址：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## API 示例

### 1. 健康检查

```bash
curl http://localhost:8000/health
```

### 2. 门店管理

#### 创建门店
```bash
curl -X POST http://localhost:8000/stores/ \
  -H "Content-Type: application/json" \
  -d '{"name": "测试门店", "address": "北京市朝阳区", "phone": "13800138000"}'
```

#### 获取所有门店
```bash
curl http://localhost:8000/stores/
```

#### 获取单个门店
```bash
curl http://localhost:8000/stores/1
```

### 3. 服务项管理

#### 创建服务项
```bash
curl -X POST http://localhost:8000/services/ \
  -H "Content-Type: application/json" \
  -d '{"store_id": 1, "name": "常规服务", "description": "标准服务"}'
```

#### 获取所有服务项
```bash
curl http://localhost:8000/services/
```

#### 获取指定门店的服务项
```bash
curl http://localhost:8000/services/store/1
```

### 4. 号段规则管理

#### 创建号段规则
```bash
curl -X POST http://localhost:8000/queue-rules/ \
  -H "Content-Type: application/json" \
  -d '{"store_id": 1, "service_id": 1, "start_time": "09:00:00", "end_time": "18:00:00", "max_queue_length": 100}'
```

#### 获取所有号段规则
```bash
curl http://localhost:8000/queue-rules/
```

#### 获取指定号段规则
```bash
curl http://localhost:8000/queue-rules/1
```

#### 获取指定门店的号段规则
```bash
curl http://localhost:8000/queue-rules/store/1
```

#### 获取指定服务项的号段规则
```bash
curl http://localhost:8000/queue-rules/service/1
```

### 5. 排队管理

#### 取号
```bash
curl -X POST http://localhost:8000/queue/get \
  -H "Content-Type: application/json" \
  -d '{"store_id": 1, "service_id": 1}'
```

#### 叫号
```bash
curl -X POST "http://localhost:8000/queue/call?store_id=1&service_id=1"
```

#### 过号
```bash
curl -X POST http://localhost:8000/queue/miss/1
```

#### 完成服务
```bash
curl -X POST http://localhost:8000/queue/complete/1
```

#### 统计当日队列长度
```bash
curl "http://localhost:8000/queue/length/today?store_id=1&service_id=1"
```

#### 统计当前等待队列长度
```bash
curl "http://localhost:8000/queue/length/waiting?store_id=1&service_id=1"
```

## Docker 部署

### 1. 构建镜像

```bash
docker build -t queue-system .
```

### 2. 运行容器

```bash
docker run -p 8000:8000 queue-system
```

## 注意事项

1. 项目使用 SQLite 数据库，数据存储在 `./queue.db` 文件中
2. 号段规则用于限制服务的营业时间和最大队列长度
3. 排队号码格式为：`YYYYMMDD-门店ID-服务ID-序号`
4. 支持多门店、多服务项的排队管理