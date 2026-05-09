# TC1 API - 用户认证系统

基于 Node.js + Express + MongoDB 构建的用户认证系统 REST API，支持注册、登录、JWT 令牌认证等功能。

## 技术栈

- **Node.js**: 后端运行环境
- **Express**: Web 应用框架
- **MongoDB**: 数据库
- **Mongoose**: MongoDB ODM
- **bcryptjs**: 密码加密
- **jsonwebtoken**: JWT 令牌生成和验证
- **cors**: 跨域资源共享
- **dotenv**: 环境变量管理

## 功能特性

- ✅ 用户注册（密码使用 bcrypt 加密存储）
- ✅ 用户登录（返回 access token 和 refresh token）
- ✅ 获取当前用户信息（需要 JWT 认证）
- ✅ 刷新 access token
- ✅ 用户登出
- ✅ 输入数据验证
- ✅ 错误处理

## 项目结构

```
TC1-API/
├── src/
│   ├── config/
│   │   ├── index.js          # 配置文件（环境变量）
│   │   └── db.js             # MongoDB 连接配置
│   ├── controllers/
│   │   └── authController.js # 认证控制器
│   ├── middleware/
│   │   └── auth.js           # JWT 认证中间件
│   ├── models/
│   │   └── User.js           # 用户模型
│   ├── routes/
│   │   └── authRoutes.js     # 路由配置
│   ├── utils/
│   │   └── jwt.js            # JWT 工具函数
│   ├── app.js                # Express 应用配置
│   └── server.js             # 服务器启动文件
├── .env.example              # 环境变量示例
├── .gitignore                # Git 忽略配置
├── package.json              # 项目依赖配置
└── README.md                 # 项目说明文档
```

## 快速开始

### 1. 环境要求

- Node.js >= 14.0.0
- MongoDB >= 4.0

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 文件为 `.env`，并根据实际情况修改配置：

```bash
cp .env.example .env
```

配置说明：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 3000 |
| MONGODB_URI | MongoDB 连接地址 | mongodb://localhost:27017/tc1-auth |
| JWT_ACCESS_SECRET | Access Token 密钥 | access-secret |
| JWT_REFRESH_SECRET | Refresh Token 密钥 | refresh-secret |
| JWT_ACCESS_EXPIRES_IN | Access Token 过期时间 | 15m |
| JWT_REFRESH_EXPIRES_IN | Refresh Token 过期时间 | 7d |

### 4. 启动 MongoDB

确保 MongoDB 服务正在运行：

```bash
# 使用本地 MongoDB
mongod

# 或使用 Docker
docker run -d -p 27017:27017 mongo
```

### 5. 启动服务器

生产环境：
```bash
npm start
```

开发环境（自动重启）：
```bash
npm run dev
```

服务器启动成功后，访问 `http://localhost:3000` 查看 API 信息。

## API 文档

### 基础 URL

```
http://localhost:3000
```

### 1. 用户注册

**端点**: `POST /register`

**请求体**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**成功响应 (201)**:
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "_id": "60d21b4667d0d8992e610c85",
      "username": "testuser",
      "email": "test@example.com",
      "createdAt": "2024-05-09T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

**错误响应**:
- `400`: 缺少必填字段、用户名或邮箱已存在、验证失败

### 2. 用户登录

**端点**: `POST /login`

**请求体**:
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "_id": "60d21b4667d0d8992e610c85",
      "username": "testuser",
      "email": "test@example.com",
      "createdAt": "2024-05-09T10:00:00.000Z",
      "__v": 0
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误响应**:
- `400`: 缺少邮箱或密码
- `401`: 邮箱或密码错误

### 3. 获取当前用户信息

**端点**: `GET /me`

**认证**: 需要 Bearer Token

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "获取用户信息成功",
  "data": {
    "user": {
      "_id": "60d21b4667d0d8992e610c85",
      "username": "testuser",
      "email": "test@example.com",
      "createdAt": "2024-05-09T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

**错误响应**:
- `401`: 未提供令牌、令牌无效或已过期、用户不存在

### 4. 刷新 Access Token

**端点**: `POST /refresh-token`

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误响应**:
- `400`: 缺少刷新令牌
- `401`: 刷新令牌无效或已过期

### 5. 用户登出

**端点**: `POST /logout`

**认证**: 需要 Bearer Token

**请求头**:
```
Authorization: Bearer <access_token>
```

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

**错误响应**:
- `401`: 未提供令牌、令牌无效或已过期

## 使用示例（cURL）

### 注册用户

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 用户登录

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 获取用户信息（需要登录）

```bash
curl -X GET http://localhost:3000/me \
  -H "Authorization: Bearer <your_access_token>"
```

### 刷新令牌

```bash
curl -X POST http://localhost:3000/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your_refresh_token>"
  }'
```

### 用户登出

```bash
curl -X POST http://localhost:3000/logout \
  -H "Authorization: Bearer <your_access_token>"
```

## 安全说明

1. **密码安全**: 密码使用 bcryptjs 进行哈希加密，加密成本为 10 轮
2. **JWT 安全**: 
   - 使用独立的 access token 和 refresh token
   - Access token 有效期较短（默认 15 分钟）
   - Refresh token 有效期较长（默认 7 天）
   - 登出时会使 refresh token 失效
3. **密码重置安全**:
   - 重置令牌使用 32 字节随机字符串（16 进制 64 字符）
   - 令牌在数据库中以 SHA256 哈希形式存储
   - 令牌有效期 15 分钟
   - 令牌使用一次后立即失效
   - 密码重置成功后自动清除用户的 refresh token（强制所有设备重新登录）
   - 忘记密码接口对存在和不存在的邮箱返回相同消息，防止邮箱枚举攻击
4. **环境变量**: 敏感信息（密钥、数据库地址）通过环境变量管理
5. **CORS**: 已配置跨域支持

## 数据模型

### User 模型

| 字段 | 类型 | 必填 | 唯一 | 说明 |
|------|------|------|------|------|
| username | String | ✅ | ✅ | 用户名（3-30 字符） |
| email | String | ✅ | ✅ | 邮箱地址（需验证格式） |
| password | String | ✅ | ❌ | 密码（最少 6 字符，加密存储） |
| refreshToken | String | ❌ | ❌ | 刷新令牌 |
| resetPasswordToken | String | ❌ | ❌ | 密码重置令牌（SHA256 哈希） |
| resetPasswordExpires | Date | ❌ | ❌ | 密码重置令牌过期时间 |
| createdAt | Date | ✅ | ❌ | 创建时间（自动生成） |

## 常见问题

### 1. MongoDB 连接失败

确保 MongoDB 服务正在运行，并且 `.env` 中的 `MONGODB_URI` 配置正确。

### 2. JWT Token 总是失效

检查 `.env` 中的 JWT 密钥配置，确保生成和验证使用相同的密钥。

### 3. 注册时提示用户名已存在

数据库中已存在相同的用户名，请使用其他用户名。

## 许可证

MIT License
