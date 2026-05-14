# CSV Analyze CLI

一个功能强大的 CSV 文件分析命令行工具，支持数据过滤、分组统计，使用策略模式设计，支持插件扩展。

## 功能特性

- ✅ 数值列统计：最小值、最大值、均值、中位数
- ✅ 类别列统计：唯一值数量、最高频值
- ✅ 数据过滤：支持 pandas.query 语法
- ✅ 分组统计：按指定列分组分析
- ✅ 插件架构：可扩展新的统计指标
- ✅ 多种输出：人类可读格式 + JSON 格式

## 安装

### PyPI 安装
```bash
pip install csv-analyze-cli
```

### 源码安装
```bash
git clone https://github.com/yourusername/csv-analyze-cli.git
cd csv-analyze-cli
pip install .
```

## 使用方法

### 基本用法
```bash
csv-analyze data.csv
```

### JSON 输出
```bash
csv-analyze data.csv --output json
```

### 数据过滤
```bash
csv-analyze data.csv --filter "age > 25 and score >= 80"
```

### 分组统计
```bash
csv-analyze data.csv --groupby city
```

### 组合使用
```bash
csv-analyze data.csv --filter "age > 25" --groupby city --output json
```

## 架构设计

### 策略模式
工具采用插件架构设计，核心类：

- `StatsPlugin`：抽象基类，定义插件接口
- `NumericalStats`：数值列统计插件
- `CategoricalStats`：类别列统计插件
- `StatsCalculator`：插件管理器和计算器

### 扩展新插件
```python
from csv_analyze import StatsPlugin, StatsCalculator

class MyCustomStats(StatsPlugin):
    def can_handle(self, series):
        # 判断是否处理该列
        return True
    
    def calculate(self, series):
        # 计算统计指标
        return {...}

calculator = StatsCalculator()
calculator.register_plugin(MyCustomStats())
```

## 开发

### 安装依赖
```bash
pip install -e ".[dev]"
```

### 运行测试
```bash
pytest test_csv_analyze.py -v
```

### PyInstaller 打包
```bash
pip install pyinstaller
pyinstaller --onefile --name csv-analyze csv_analyze.py
```

## License

MIT License
