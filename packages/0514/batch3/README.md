# 全栈问卷调查系统

基于 Django + React 的问卷调查系统，支持逻辑跳转、防重复提交和 CRM 集成。

## 功能特性

### 后端 (Django)
- 问卷 CRUD 管理
- 问题类型支持：单选、多选、文本
- 逻辑跳转规则存储（JSON）
- Token 防重复提交机制
- CRM Webhook 集成
- RESTful API 设计

### 前端 (React)
- 问卷列表展示
- 动态表单渲染（Formik）
- 逻辑跳转前端实现
- LocalStorage Token 存储
- 响应式设计

## 项目结构

```
batch3/
├── survey_backend/          # Django 后端
│   ├── surveys/             # 问卷应用
│   │   ├── models.py        # 数据模型
│   │   ├── views.py         # API 视图
│   │   ├── serializers.py   # 序列化器
│   │   ├── services.py      # CRM 服务
│   │   ├── tests.py         # 单元测试
│   │   └── management/      # 数据命令
│   ├── survey_backend/      # 项目配置
│   ├── requirements.txt     # 依赖
│   └── manage.py
└── survey-frontend/         # React 前端
    ├── src/
    │   ├── components/      # 组件
    │   ├── services/        # API 服务
    │   ├── types/           # TypeScript 类型
    │   └── App.tsx
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

## 快速开始

### 后端启动

```bash
cd survey_backend
pip install -r requirements.txt
python manage.py migrate
python manage.py create_sample_data  # 创建示例问卷
python manage.py runserver
```

后端运行在 http://localhost:8000

### 前端启动

```bash
cd survey-frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/surveys/` | 获取问卷列表 |
| GET | `/api/surveys/<id>/` | 获取问卷详情 |
| POST | `/api/responses/submit/` | 提交问卷回答 |
| GET | `/api/responses/check-token/<token>/` | 检查 Token 是否已使用 |

## 逻辑跳转说明

问题的 `skip_logic` 字段结构：

```json
{
  "conditions": [
    {
      "answer": "否",
      "action": "jump",
      "target_question_order": 3
    },
    {
      "answer": "是",
      "action": "next"
    }
  ]
}
```

- `action: "jump"`：跳转到指定 `target_question_order` 的问题
- `action: "next"`：按顺序显示下一题

## CRM Webhook 集成

在 Django settings 中配置：

```python
CRM_WEBHOOK_URL = "https://your-crm.com/webhook"
CRM_API_KEY = "your-api-key"  # 可选
```

问卷提交后会自动发送数据到 CRM。

## 运行测试

### 后端测试

```bash
cd survey_backend
python manage.py test
```

### 前端测试

```bash
cd survey-frontend
npm test
```

## 数据模型

### Survey（问卷）
- title: 标题
- description: 描述
- created_at: 创建时间

### Question（问题）
- survey: 外键关联问卷
- text: 问题文本
- question_type: 类型（single/multiple/text）
- options: 选项列表
- order: 显示顺序
- skip_logic: 逻辑跳转规则

### Response（作答）
- survey: 外键关联问卷
- token: 防重复提交 Token
- submitted_at: 提交时间
- crm_webhook_status: CRM 推送状态
- crm_webhook_message: CRM 推送消息

### Answer（答案）
- response: 外键关联作答
- question: 外键关联问题
- value: 答案内容
