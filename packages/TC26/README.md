# GeoViz - 地理数据可视化工具

使用 Folium 构建的可配置地理数据可视化类，支持交互式地图、热力图、图例和 PNG 导出。

## 功能特性

- ✅ 面向对象的 GeoViz 类，易于配置和扩展
- ✅ 支持 CSV 文件或 Pandas DataFrame 输入
- ✅ 可自定义地图中心和初始缩放级别
- ✅ 8 种预设颜色方案（viridis, plasma, coolwarm 等）
- ✅ 圆形标记（大小与数值成正比）
- ✅ 热力图层
- ✅ 自动图例（颜色条）
- ✅ 导出为交互式 HTML
- ✅ 使用 Selenium 导出为 PNG 图片
- ✅ 链式调用 API

## 安装依赖

```bash
pip install -r requirements.txt
```

### PNG 导出额外要求

导出 PNG 需要安装 ChromeDriver：
1. 下载对应 Chrome 版本的 [ChromeDriver](https://sites.google.com/chromium.org/driver/)
2. 将 ChromeDriver 添加到系统 PATH 中

## 快速开始

```python
from geoviz import GeoViz

# 1. 生成示例数据（或读取你的 CSV）
GeoViz.generate_sample_data('data.csv', 100)

# 2. 创建可视化对象
viz = GeoViz('data.csv')

# 3. 链式配置
viz.set_zoom(8)
viz.set_color_scheme('viridis')
viz.create_map()
viz.add_legend(title='数值')

# 4. 导出
viz.save_html('my_map.html')

# 5. 可选：导出 PNG（需要 ChromeDriver）
# viz.export_png('my_map.png', width=1920, height=1080)
```

## API 文档

### GeoViz 类

#### 初始化

```python
GeoViz(
    csv_path=None,      # CSV 文件路径（与 df 二选一）
    df=None,            # Pandas DataFrame（与 csv_path 二选一）
    lat_col='latitude', # 纬度列名
    lon_col='longitude',# 经度列名
    value_col='value'   # 数值列名
)
```

#### 配置方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `set_map_center(lat, lon)` | lat, lon | self | 设置地图中心坐标 |
| `set_zoom(zoom)` | zoom | self | 设置初始缩放级别 |
| `set_color_scheme(scheme)` | scheme_name | self | 设置颜色映射方案 |

#### 可用颜色方案

| 方案名称 | 描述 |
|----------|------|
| `viridis` | Matplotlib 默认蓝绿黄渐变 |
| `plasma` | 紫蓝黄渐变 |
| `coolwarm` | 蓝白红冷暖渐变 |
| `red_blue` | 红蓝渐变 |
| `green_red` | 绿红渐变 |
| `blue_green_red` | 蓝绿红三色 |
| `yellow_red` | 黄红渐变 |
| `purple_orange` | 紫橙渐变 |

#### 创建地图

```python
viz.create_map(
    min_radius=5,           # 最小标记半径
    max_radius=50,          # 最大标记半径
    opacity=0.6,            # 标记透明度
    show_markers=True,      # 是否显示圆形标记
    show_heatmap=True,      # 是否显示热力图
    heatmap_radius=15       # 热力图半径
)
```

#### 添加图例

```python
viz.add_legend(
    title='数值',                   # 图例标题
    position='bottomright'          # 位置
)
```

位置可选：`topright`, `topleft`, `bottomright`, `bottomleft`

#### 导出方法

```python
# 保存为 HTML（交互式）
viz.save_html('map.html')

# 导出为 PNG（需要 ChromeDriver）
viz.export_png(
    'map.png',
    width=1920,        # 截图宽度
    height=1080,       # 截图高度
    wait_time=3        # 等待地图加载时间（秒）
)
```

## 使用示例

### 示例 1：基础用法

```python
from geoviz import GeoViz

viz = GeoViz('data.csv')
viz.create_map()
viz.add_legend()
viz.save_html('map.html')
```

### 示例 2：完整配置

```python
from geoviz import GeoViz
import pandas as pd

# 自定义数据
df = pd.DataFrame({
    'lat': [31.23, 39.90, 22.54],
    'lng': [121.47, 116.40, 114.05],
    'weight': [85, 92, 78]
})

viz = GeoViz(
    df=df,
    lat_col='lat',
    lon_col='lng',
    value_col='weight'
)

viz.set_map_center(35.0, 117.0)
viz.set_zoom(5)
viz.set_color_scheme('plasma')

viz.create_map(
    min_radius=8,
    max_radius=30,
    opacity=0.7,
    heatmap_radius=20
)

viz.add_legend(title='城市权重', position='bottomleft')
viz.save_html('china_cities.html')
```

### 示例 3：仅热力图

```python
viz = GeoViz('data.csv')
viz.create_map(
    show_markers=False,
    show_heatmap=True,
    heatmap_radius=30
)
viz.add_legend(title='密度')
viz.save_html('heatmap.html')
```

### 示例 4：仅标记

```python
viz = GeoViz('data.csv')
viz.set_color_scheme('coolwarm')
viz.create_map(
    show_markers=True,
    show_heatmap=False,
    min_radius=5,
    max_radius=40,
    opacity=0.8
)
viz.add_legend(title='数值')
viz.save_html('markers.html')
```

## 运行示例脚本

```bash
# 运行所有示例
python example_usage.py

# 运行基础版
python geoviz.py
```

这将生成多个示例地图文件，你可以在浏览器中打开查看。

## 文件结构

```
.
├── geoviz.py           # 主模块，包含 GeoViz 类
├── example_usage.py    # 完整使用示例
├── requirements.txt    # 依赖列表
└── README.md           # 本文档
```

## 注意事项

1. **PNG 导出**：需要安装 ChromeDriver 并配置好环境变量
2. **大数据量**：如果数据点超过 1000 个，建议关闭标记显示（`show_markers=False`），仅使用热力图
3. **坐标格式**：纬度范围 [-90, 90]，经度范围 [-180, 180]
4. **颜色方案**：可以在 `GeoViz.COLOR_SCHEMES` 中添加自定义颜色方案

## 故障排除

### PNG 导出失败

1. 确认已安装 ChromeDriver：`chromedriver --version`
2. 确认 ChromeDriver 版本与 Chrome 浏览器版本匹配
3. 增加 `wait_time` 参数，给地图更多加载时间

### 地图显示空白

1. 检查纬度/经度列名是否正确
2. 确认坐标值在有效范围内
3. 尝试调整地图中心和缩放级别

### 颜色不显示

1. 确认数值列包含有效的数字
2. 检查数值范围是否合理（不是全部相同）
