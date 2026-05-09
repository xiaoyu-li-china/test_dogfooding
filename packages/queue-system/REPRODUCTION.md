# 并发取号重复号码问题复现与修复

## 问题描述

首轮上线后，并发两个客户端对同一门店同一服务同时取号，偶现**重复号码**的问题。

## 根因分析

**问题根因**：在 `QueueService.get_queue` 方法中，号码生成和创建记录的过程不是原子操作，存在竞态条件：

1. 客户端 A 查询最后一条排队记录，得到号码 N
2. 客户端 B 同时查询最后一条排队记录，同样得到号码 N
3. 客户端 A 生成新号码 N+1 并创建记录
4. 客户端 B 也生成新号码 N+1 并创建记录
5. 最终导致两条记录拥有相同的排队号码

## 修复方案

**修复策略**：使用乐观锁机制，通过检查-创建-重试的方式确保号码唯一性：

1. 生成队列号
2. 检查该号码是否已存在
3. 如果不存在，创建新记录并提交事务
4. 如果存在或发生冲突，回滚事务并重试

## 最小复现步骤

### 1. 启动服务

```bash
python3 main.py
```

### 2. 创建门店

```bash
curl -X POST http://localhost:8000/stores/ \
  -H "Content-Type: application/json" \
  -d '{"name": "测试门店", "address": "北京市朝阳区", "phone": "13800138000"}'
```

### 3. 创建服务项

```bash
curl -X POST http://localhost:8000/services/ \
  -H "Content-Type: application/json" \
  -d '{"store_id": 1, "name": "常规服务", "description": "标准服务"}'
```

### 4. 运行并发测试

```bash
python3 test_concurrent_queue.py
```

## 验证方法

运行并发测试脚本后，检查输出是否显示 "Test passed: No duplicate queue numbers"。

## 测试覆盖

- 并发 10 个请求同时取号
- 验证生成的排队号码是否唯一
- 验证服务是否正常处理并发请求

## 修复效果

修复后，即使在高并发场景下，也能确保排队号码的唯一性，避免重复号码的产生。