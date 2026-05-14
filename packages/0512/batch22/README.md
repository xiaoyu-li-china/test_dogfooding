# Elasticsearch Search API

使用 Elasticsearch 和 Node.js 构建的搜索 API，支持中文分词（IK 插件）。

## 环境要求

- Node.js >= 16.x
- Elasticsearch >= 8.x
- IK 中文分词插件

## 安装依赖

```bash
npm install
```

## 配置 Elasticsearch

1. 安装 IK 分词插件：

```bash
# 进入 Elasticsearch 安装目录
cd /path/to/elasticsearch

# 安装 IK 插件（版本需与 Elasticsearch 版本对应）
./bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v8.12.0/elasticsearch-analysis-ik-8.12.0.zip
```

2. 重启 Elasticsearch 服务

3. 配置环境变量（可选）：

复制 `.env` 文件并修改配置：

```bash
cp .env.example .env
```

## 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API 接口

### 搜索文档

**POST /search**

请求体：
```json
{
  "query": "搜索关键词",
  "filters": {
    "category": "技术"
  },
  "page": 1,
  "size": 10
}
```

响应：
```json
{
  "total": 100,
  "page": 1,
  "size": 10,
  "data": [
    {
      "id": "document_id",
      "title": "文档标题",
      "titleHighlight": ["<em>关键词</em>出现在标题中"],
      "contentHighlight": ["<em>关键词</em>出现在内容中的片段..."]
    }
  ]
}
```

### 创建文档

**POST /documents**

请求体：
```json
{
  "title": "文档标题",
  "content": "文档内容",
  "category": "技术"
}
```

### 获取文档

**GET /documents/:id**

### 更新文档

**PUT /documents/:id**

请求体：
```json
{
  "title": "新标题",
  "content": "新内容"
}
```

### 删除文档

**DELETE /documents/:id**

## 使用说明

### IK 分词器

- `ik_max_word`: 细粒度分词，适合索引
- `ik_smart`: 粗粒度分词，适合搜索

API 默认使用 `ik_max_word` 进行搜索，可根据需要调整。
