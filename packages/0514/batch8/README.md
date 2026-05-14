# Health Check Docker Service

HTTP 服务健康检查工具，支持定时执行、Prometheus 指标暴露、钉钉/企业微信告警。

## 功能特性

- ✅ 多 URL 并发健康检查
- ✅ 响应状态码验证
- ✅ 响应内容关键字检查
- ✅ Prometheus 指标暴露 (`/metrics`)
- ✅ 定时执行（可配置间隔）
- ✅ 连续失败告警（钉钉/企业微信）
- ✅ Docker 容器化部署
- ✅ 内置 Prometheus 监控栈

## Prometheus 指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `health_check_requests_total` | Counter | 请求总数（按 URL 和状态分组） |
| `health_check_consecutive_failures` | Gauge | 连续失败次数 |
| `health_check_response_time_seconds` | Histogram | 响应时间分布 |
| `health_check_status` | Gauge | 服务状态（1=正常，0=失败） |
| `health_check_last_timestamp` | Gauge | 最后检查时间戳 |
| `health_check_alerts_total` | Counter | 告警总数 |

## 快速开始

### 1. 启动服务

```bash
docker-compose up -d
```

### 2. 访问端点

| 端点 | 说明 | URL |
|-----|------|-----|
| `/metrics` | Prometheus 指标 | http://localhost:8080/metrics |
| `/health` | 服务自身健康检查 | http://localhost:8080/health |
| `/check` | 手动触发检查 | http://localhost:8080/check |
| Prometheus UI | 监控面板 | http://localhost:9090 |

## 环境变量配置

在 `docker-compose.yml` 中配置：

```yaml
environment:
  - CHECK_URLS=https://api.example.com,https://service.example.com
  - CHECK_KEYWORDS=OK,success
  - CHECK_TIMEOUT=10
  - CHECK_INTERVAL=60
  - DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
  - WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

### 变量说明

| 变量 | 必填 | 默认值 | 说明 |
|-----|------|--------|------|
| `CHECK_URLS` | 是 | - | 要检查的 URL 列表，逗号分隔 |
| `CHECK_KEYWORDS` | 否 | - | 响应中应包含的关键字，逗号分隔 |
| `CHECK_TIMEOUT` | 否 | 10 | 请求超时时间（秒） |
| `CHECK_INTERVAL` | 否 | 60 | 检查间隔（秒），0 禁用定时 |
| `DINGTALK_WEBHOOK` | 否 | - | 钉钉机器人 Webhook 地址 |
| `WECHAT_WEBHOOK` | 否 | - | 企业微信机器人 Webhook 地址 |

## 单独使用 Docker 镜像

### 构建镜像

```bash
docker build -t health-check:latest .
```

### 运行容器

```bash
docker run -d \
  --name health-check \
  -p 8080:8080 \
  -e CHECK_URLS=https://httpbin.org/get,https://example.com \
  -e CHECK_INTERVAL=30 \
  -v health-check-data:/data \
  health-check:latest
```

## Prometheus 查询示例

### 查看所有服务状态

```promql
health_check_status
```

### 查看连续失败次数

```promql
health_check_consecutive_failures
```

### 计算成功率

```promql
sum by (url) (increase(health_check_requests_total{status="success"}[5m])) 
/ 
sum by (url) (increase(health_check_requests_total[5m]))
```

### 95 分位响应时间

```promql
histogram_quantile(0.95, sum by (url, le) (rate(health_check_response_time_seconds_bucket[5m])))
```

## 告警规则

内置告警规则（`alert_rules.yml`）：

1. **ServiceDown** - 服务宕机（持续 1 分钟）
2. **HighResponseTime** - 响应时间过高（平均 > 5 秒，持续 2 分钟）
3. **ConsecutiveFailures** - 连续失败（>= 3 次立即告警）

## 目录结构

```
.
├── Dockerfile              # Docker 镜像构建配置
├── docker-compose.yml      # 编排配置（含 Prometheus）
├── health_check_server.py  # 主程序
├── requirements.txt        # Python 依赖
├── prometheus.yml          # Prometheus 配置
├── alert_rules.yml         # Prometheus 告警规则
└── README.md              # 本文档
```

## 数据持久化

失败计数保存在 `/data/failure_counts.json`，通过 Docker volume 持久化，容器重启不会丢失。
