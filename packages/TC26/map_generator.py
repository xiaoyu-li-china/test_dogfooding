import folium
import pandas as pd
from folium.plugins import HeatMap
import numpy as np


def create_interactive_map(csv_path, output_html='map.html', lat_col='latitude', 
                           lon_col='longitude', value_col='value', 
                           center_lat=None, center_lon=None, zoom_start=10,
                           min_radius=5, max_radius=50, opacity=0.6,
                           heatmap_radius=15):
    """
    创建交互式地图，包含圆形标记和热力图层
    
    Args:
        csv_path: CSV文件路径
        output_html: 输出HTML文件路径
        lat_col: 纬度列名
        lon_col: 经度列名
        value_col: 数值列名
        center_lat: 地图中心纬度（默认使用数据平均值）
        center_lon: 地图中心经度（默认使用数据平均值）
        zoom_start: 初始缩放级别
        min_radius: 最小标记半径
        max_radius: 最大标记半径
        opacity: 标记透明度
        heatmap_radius: 热力图半径
    """
    df = pd.read_csv(csv_path)
    
    if center_lat is None:
        center_lat = df[lat_col].mean()
    if center_lon is None:
        center_lon = df[lon_col].mean()
    
    m = folium.Map(location=[center_lat, center_lon], zoom_start=zoom_start)
    
    values = df[value_col].values
    min_val = values.min()
    max_val = values.max()
    
    for idx, row in df.iterrows():
        lat = row[lat_col]
        lon = row[lon_col]
        value = row[value_col]
        
        if max_val != min_val:
            radius = min_radius + (value - min_val) / (max_val - min_val) * (max_radius - min_radius)
        else:
            radius = (min_radius + max_radius) / 2
        
        color = f'#{int(255 * (1 - (value - min_val) / (max_val - min_val))):02x}00{int(255 * (value - min_val) / (max_val - min_val)):02x}'
        
        folium.CircleMarker(
            location=[lat, lon],
            radius=radius,
            popup=f'Value: {value}',
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=opacity
        ).add_to(m)
    
    heat_data = [[row[lat_col], row[lon_col], row[value_col]] for idx, row in df.iterrows()]
    HeatMap(heat_data, radius=heatmap_radius).add_to(m)
    
    m.save(output_html)
    print(f'地图已保存到 {output_html}')
    
    return m


def generate_sample_data(csv_path='sample_data.csv', num_points=100):
    """
    生成示例CSV数据
    """
    np.random.seed(42)
    
    data = {
        'latitude': np.random.uniform(30, 40, num_points),
        'longitude': np.random.uniform(110, 120, num_points),
        'value': np.random.randint(1, 100, num_points)
    }
    
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    print(f'示例数据已保存到 {csv_path}')
    return df


if __name__ == '__main__':
    generate_sample_data()
    create_interactive_map('sample_data.csv', 'my_map.html')
