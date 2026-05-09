# Webhook Service with Retry Queue

基于 TypeScript + Node.js 20 实现的 Webhook 接收服务，支持：
- 接收第三方 Webhook JSON 并写入 SQLite
- 指数退避重试队列（进程内）
- 死信标记
- 分页查询事件
- 事件重放演示

## 技术栈

- **Node.js 20**: LTS 版本，支持最新 JavaScript 特性
- **TypeScript**: 类型安全，提升开发体验
- **Fastify**: 高性能 Web 框架（选择理由见下方）
- **Prisma**: 类型安全的 ORM，支持 SQLite
- **SQLite**: 轻量级嵌入式数据库

### 为什么选择 Fastify？

本项目选择 **Fastify** 而非 Express，主要基于以下理由：

1. **性能**：Fastify 是目前最快的 Node.js Web 框架之一，吞吐量约为 Express 的 2-3 倍，这对于高并发的 Webhook 接收场景非常重要。
2. **JSON 处理**：Fastify 内置了高效的 JSON 序列化/反序列化，非常适合处理 Webhook 这种 JSON 密集型场景。
3. **类型支持**：Fastify 对 TypeScript 有更好的原生支持，路由、请求体、响应体都能获得完整的类型提示。
4. **插件生态**：Fastify 拥有丰富的插件生态，同时保持了核心的轻量。
5. **Schema 验证**：内置 JSON Schema 验证，可以轻松定义和验证请求/响应格式。

## 项目结构

```
.
├── prisma/
│   └── schema.prisma       # 数据库模型定义
├── src/
│   ├── config/
│   │   └── queue.ts        # 队列配置与指数退避算法
│   ├── lib/
│   │   └── prisma.ts       # Prisma 客户端实例
│   ├── routes/
│   │   ├── events.ts       # 事件查询路由
│   │   ├── simulate.ts     # 重放模拟路由
│   │   └── webhook.ts      # Webhook 接收路由
│   ├── services/
│   │   ├── queueService.ts # 重试队列服务
│   │   └── webhookService.ts # Webhook 业务逻辑
│   ├── utils/
│   │   └── hash.ts         # Payload Hash 计算工具
│   └── index.ts            # 应用入口
├── .dockerignore
├── .env
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 数据库模型

事件表包含以下字段：

| 字段           | 类型     | 说明                     |
|----------------|----------|--------------------------|
| `id`           | String   | 内部主键（CUID）         |
| `eventId`      | String   | 外部事件 ID（唯一）      |
| `payloadHash`  | String   | Payload 的 SHA-256 哈希  |
| `receivedAt`   | DateTime | 接收时间                 |
| `status`       | Enum     | 处理状态                 |
| `retryCount`   | Int      | 重试次数                 |
| `lastRetryAt`  | DateTime?| 最后重试时间             |
| `nextRetryAt`  | DateTime?| 下次重试时间             |
| `errorMessage` | String?  | 错误信息                 |

**状态枚举**：
- `PENDING`: 待处理
- `PROCESSING`: 处理中
- `SUCCESS`: 处理成功
- `FAILED`: 处理失败（等待重试）
- `DEAD_LETTER`: 死信（超过最大重试次数）

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm 或 pnpm

### 本地开发

1. **安装依赖**

```bash
npm install
```

2. **配置环境变量**

复制 `.env` 文件（已默认创建）：

```env
DATABASE_URL="file:./dev.db"
PORT=3000
```

3. **初始化数据库**

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **启动开发服务器**

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动，并在文件变更时自动重启。

### 生产构建

```bash
npm run build
npm run start
```

## API 接口

### 1. 接收 Webhook

```bash
POST /webhook
Content-Type: application/json
```

请求体必须包含 `event_id` 字段：

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_id": "evt_123", "type": "payment.created", "amount": 100}'
```

响应：

```json
{
  "message": "Webhook accepted",
  "eventId": "evt_123",
  "status": "PENDING"
}
```

### 2. 分页查询事件

```bash
GET /events?page=1&limit=20&status=PENDING
```

参数：
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 100）
- `status`: 按状态过滤（可选）

示例：

```bash
curl "http://localhost:3000/events?page=1&limit=10&status=FAILED"
```

响应：

```json
{
  "events": [
    {
      "id": "cuid...",
      "eventId": "evt_123",
      "payloadHash": "abc123...",
      "receivedAt": "2024-01-01T00:00:00.000Z",
      "status": "FAILED",
      "retryCount": 3,
      "lastRetryAt": "2024-01-01T00:05:00.000Z",
      "nextRetryAt": "2024-01-01T00:15:00.000Z",
      "errorMessage": "Timeout"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### 3. 重放事件

```bash
POST /simulate/:id/replay
```

参数：
- `:id`: 事件的 `event_id`

请求体（可选）：
- `simulateFailure`: 是否模拟失败（默认 false）
- `errorMessage`: 自定义错误信息

**正常重放示例**：

```bash
curl -X POST http://localhost:3000/simulate/evt_123/replay
```

**模拟失败重放示例**：

```bash
curl -X POST http://localhost:3000/simulate/evt_123/replay \
  -H "Content-Type: application/json" \
  -d '{"simulateFailure": true, "errorMessage": "Simulated network error"}'
```

### 4. 健康检查

```bash
GET /health
```

```bash
curl http://localhost:3000/health
```

## 指数退避重试机制

服务实现了进程内的指数退避重试队列：

### 配置参数（可在 `src/config/queue.ts` 调整）

| 参数               | 默认值 | 说明                     |
|--------------------|--------|--------------------------|
| `MAX_RETRY_COUNT`  | 5      | 最大重试次数             |
| `INITIAL_DELAY_MS` | 1000   | 初始延迟（毫秒）         |
| `MAX_DELAY_MS`     | 60000  | 最大延迟（毫秒）         |
| `BACKOFF_FACTOR`   | 2      | 退避因子                 |
| `POLL_INTERVAL_MS` | 5000   | 轮询间隔（毫秒）         |
| `JITTER_MS`        | 1000   | 抖动范围（毫秒）         |

### 重试延迟计算

延迟公式：`delay = min(INITIAL_DELAY_MS * (BACKOFF_FACTOR ^ retryCount), MAX_DELAY_MS) + random(JITTER_MS)`

示例延迟序列（假设无抖动）：
- 第 1 次重试：1 秒
- 第 2 次重试：2 秒
- 第 3 次重试：4 秒
- 第 4 次重试：8 秒
- 第 5 次重试：16 秒
- 第 6 次及以后：标记为死信（不再重试）

## Docker 部署

### 构建镜像

```bash
docker build -t webhook-service .
```

### 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  -v webhook-data:/data \
  --name webhook-service \
  webhook-service
```

**初始化数据库（首次运行）**：

```bash
docker exec webhook-service npx prisma migrate deploy
```

### 使用 Docker Compose（可选）

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - webhook-data:/data
    environment:
      - DATABASE_URL=file:/data/prod.db
      - PORT=3000

volumes:
  webhook-data:
```

启动：
```bash
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
```

## 测试提示

### 测试重试机制

1. 发送一个 Webhook：
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_id": "test_retry_1", "type": "test"}'
```

2. 查看事件状态变化：
```bash
curl "http://localhost:3000/events?eventId=test_retry_1"
```

### 测试死信队列

1. 使用模拟失败接口发送多个失败重放：
```bash
curl -X POST http://localhost:3000/simulate/test_dlq/replay \
  -H "Content-Type: application/json" \
  -d '{"simulateFailure": true}'
```

2. 重复调用 5 次以上，观察状态变为 `DEAD_LETTER`。

## 注意事项

1. **进程内队列**：本实现的重试队列是进程内的，如果进程重启，未完成的重试任务可能会丢失。生产环境建议使用 Redis、RabbitMQ 等外部消息队列。
2. **SQLite 并发**：SQLite 适合低并发场景。高并发时建议使用 PostgreSQL 或 MySQL。
3. **Payload 存储**：当前实现仅存储 payload 的哈希值，不存储原始 payload。如果需要存储原始 payload，需要修改数据库模型。
4. **幂等性**：通过 `eventId` 保证幂等，重复发送相同 `eventId` 的 Webhook 只会创建一条记录。

## License

MIT
