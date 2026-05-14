# GitHub Action: Python 依赖更新检查器

一个自动检查 Python 依赖更新和安全漏洞的 GitHub Action，支持自动创建 PR。

## 功能特性

- ✅ 支持三种依赖文件格式：`requirements.txt`、`pyproject.toml` (Poetry)、`Pipfile`
- 🔒 集成 Safety DB 检查已知安全漏洞
- 📊 生成详细的更新报告
- 🔀 自动创建带有依赖更新的 PR
- ⚙️ 可配置是否允许 major 版本升级
- ⏰ 支持每周定时运行

## 使用方法

### 基本使用（每周一自动运行）

在你的仓库中创建 `.github/workflows/dependency-updates.yml` 文件：

```yaml
name: Weekly Dependency Updates

on:
  schedule:
    - cron: '0 0 * * 1'  # 每周一 UTC 0 点运行
  workflow_dispatch:  # 允许手动触发

jobs:
  check-updates:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Run Dependency Checker
        uses: your-username/dep-updater@main
        with:
          requirements-file: requirements.txt
          create-pr: true
          allow-major: false
```

### 输入参数

| 参数 | 描述 | 默认值 |
|------|------|--------|
| `requirements-file` | 依赖文件路径 | `requirements.txt` |
| `create-pr` | 是否自动创建 PR | `true` |
| `base-branch` | PR 目标分支 | `main` |
| `allow-major` | 允许升级 major 版本 | `false` |
| `skip-security` | 跳过安全漏洞检查 | `false` |

### 输出参数

| 输出 | 描述 |
|------|------|
| `report` | 生成的更新报告 |
| `pr-url` | 创建的 PR 链接 |

## 完整示例

```yaml
name: Dependency Update Checker

on:
  schedule:
    - cron: '0 0 * * 1'  # 每周一
  workflow_dispatch:
    inputs:
      allow_major:
        description: 'Allow major version updates'
        required: false
        default: 'false'
        type: choice
        options:
          - 'true'
          - 'false'

jobs:
  check-updates:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Check dependencies
        id: check
        uses: ./
        with:
          requirements-file: requirements.txt
          create-pr: true
          allow-major: ${{ github.event.inputs.allow_major || 'false' }}
      
      - name: Show report summary
        run: |
          echo "Dependency check completed!"
          echo "Report: ${{ steps.check.outputs.report }}"
```

## PR 示例

自动创建的 PR 将包含：

- 标题：`Update dependencies to latest versions`
- 描述：完整的更新报告，包括：
  - 需要更新的依赖列表（当前版本 → 新版本）
  - 发现的安全漏洞详情（如有）
  - 已是最新版本的依赖

## 权限说明

确保你的工作流具有以下权限：

```yaml
permissions:
  contents: write      # 用于创建分支和更新文件
  pull-requests: write # 用于创建 PR
```

## 本地测试

在本地运行脚本进行测试：

```bash
pip install packaging requests tomli
python dep_updater.py --file requirements.txt
```

## 文件结构

```
.
├── dep_updater.py          # 主脚本
├── action.yml              # Docker 容器 Action 定义
├── composite-action.yml    # Composite Action 定义（推荐使用）
├── Dockerfile              # Docker 镜像定义
├── .github/
│   └── workflows/
│       └── dependency-updates.yml  # 示例工作流
└── test_dep_updater.py     # 测试文件
```

## 注意事项

1. 默认情况下，脚本只升级 minor 和 patch 版本，不会升级 major 版本（如 2.x → 3.x）
2. 如果检测到安全漏洞，会在报告中高亮显示并优先升级
3. 如果没有需要更新的依赖，不会创建 PR
4. PyPI 和 Safety DB 的 API 调用有速率限制，请避免过于频繁的运行

## 许可证

MIT License
