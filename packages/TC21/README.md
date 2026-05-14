# Image Super-Resolution API

基于 FastAPI + PyTorch 的图片超分辨率 API，使用 SRCNN 模型实现图片放大 2 倍或 4 倍。

## 功能特性

- 🚀 **FastAPI** 高性能 Web 框架
- 🧠 **PyTorch** 深度学习推理
- 📈 **SRCNN** 轻量级超分辨率模型
- 💤 **模型懒加载** - 首次请求时才加载模型
- 🔒 **并发限制** - 最多同时处理 2 个任务
- 📊 **自动文档** - Swagger UI 集成

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

## API 文档

启动服务后，访问以下地址查看交互式文档：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API 使用

### 超分辨率接口

**POST** `/upscale`

上传图片进行超分辨率处理。

**参数:**
- `file`: 图片文件（必填）
- `scale`: 放大倍数，可选值：2 或 4（默认：4）

**使用示例:**

```bash
# 使用 curl
curl -X POST "http://localhost:8000/upscale" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@input.jpg" \
  -F "scale=4" \
  --output upscaled.png
```

```python
# 使用 Python requests
import requests

url = "http://localhost:8000/upscale"
files = {"file": open("input.jpg", "rb")}
data = {"scale": 4}

response = requests.post(url, files=files, data=data)
with open("upscaled.png", "wb") as f:
    f.write(response.content)
```

**响应:**
- 成功：返回处理后的 PNG 图片
- 失败：返回 JSON 错误信息

### 健康检查

**GET** `/health`

检查服务状态和模型加载状态。

```bash
curl http://localhost:8000/health
```

响应示例:
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### 根路径

**GET** `/`

返回 API 基本信息。

## 技术实现

### 模型架构 (SRCNN)

SRCNN (Super-Resolution Convolutional Neural Network) 是一个轻量级的超分辨率模型：

- Conv1: 3 → 64 channels, 9×9 kernel
- Conv2: 64 → 32 channels, 1×1 kernel  
- Conv3: 32 → 3 channels, 5×5 kernel

### 并发控制

使用 `asyncio.Semaphore(2)` 限制同时处理的请求数量，避免服务器过载。

### 模型懒加载

模型在首次调用 `/upscale` 时才加载到内存，节省启动时间和内存。

## 注意事项

1. 模型使用随机初始化权重（演示用途）
2. 生产环境请加载预训练权重
3. 建议在 GPU 环境下运行以获得最佳性能
4. 支持的图片格式：JPG, PNG 等 PIL 支持的格式
