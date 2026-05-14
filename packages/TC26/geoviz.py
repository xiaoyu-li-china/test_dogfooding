import folium
import pandas as pd
from folium.plugins import HeatMap
from folium import Element
import numpy as np
import os
import time
from branca.colormap import LinearColormap


class GeoViz:
    """
    地理数据可视化类，支持交互式地图、热力图和图例
    """
    
    COLOR_SCHEMES = {
        'red_blue': ['#ff0000', '#0000ff'],
        'green_red': ['#00ff00', '#ff0000'],
        'blue_green_red': ['#0000ff', '#00ff00', '#ff0000'],
        'yellow_red': ['#ffff00', '#ff0000'],
        'purple_orange': ['#800080', '#ffa500'],
        'viridis': ['#440154', '#482878', '#3e4989', '#31688e', '#26838e', '#1f9d8a', '#6cce59', '#b5de2b', '#fde725'],
        'plasma': ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
        'coolwarm': ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
    }
    
    def __init__(self, csv_path=None, df=None, lat_col='latitude', 
                 lon_col='longitude', value_col='value'):
        """
        初始化 GeoViz 对象
        
        Args:
            csv_path: CSV文件路径（与 df 二选一）
            df: pandas DataFrame（与 csv_path 二选一）
            lat_col: 纬度列名
            lon_col: 经度列名
            value_col: 数值列名
        """
        if df is not None:
            self.df = df.copy()
        elif csv_path is not None:
            self.df = pd.read_csv(csv_path)
        else:
            raise ValueError("必须提供 csv_path 或 df 参数")
        
        self.lat_col = lat_col
        self.lon_col = lon_col
        self.value_col = value_col
        
        self.center_lat = self.df[lat_col].mean()
        self.center_lon = self.df[lon_col].mean()
        self.zoom_start = 10
        
        self.min_val = self.df[value_col].min()
        self.max_val = self.df[value_col].max()
        
        self.map = None
        self.color_scheme = 'viridis'
        self.colormap = None
        
    def set_map_center(self, lat, lon):
        """设置地图中心坐标"""
        self.center_lat = lat
        self.center_lon = lon
        return self
        
    def set_zoom(self, zoom):
        """设置初始缩放级别"""
        self.zoom_start = zoom
        return self
        
    def set_color_scheme(self, scheme_name):
        """
        设置颜色映射方案
        
        Args:
            scheme_name: 方案名称，可选: 'red_blue', 'green_red', 'blue_green_red', 
                        'yellow_red', 'purple_orange', 'viridis', 'plasma', 'coolwarm'
        """
        if scheme_name not in self.COLOR_SCHEMES:
            raise ValueError(f"颜色方案必须是以下之一: {list(self.COLOR_SCHEMES.keys())}")
        self.color_scheme = scheme_name
        return self
        
    def _create_colormap(self):
        """创建颜色映射对象"""
        colors = self.COLOR_SCHEMES[self.color_scheme]
        self.colormap = LinearColormap(
            colors=colors,
            vmin=self.min_val,
            vmax=self.max_val
        )
        return self.colormap
        
    def _get_color(self, value):
        """根据数值获取颜色"""
        if self.colormap is None:
            self._create_colormap()
        return self.colormap(value)
        
    def _normalize_value(self, value):
        """将数值归一化到 [0, 1] 范围"""
        if self.max_val == self.min_val:
            return 0.5
        return (value - self.min_val) / (self.max_val - self.min_val)
        
    def create_map(self, min_radius=5, max_radius=50, opacity=0.6,
                   show_markers=True, show_heatmap=True, heatmap_radius=15):
        """
        创建交互式地图
        
        Args:
            min_radius: 最小标记半径
            max_radius: 最大标记半径
            opacity: 标记透明度
            show_markers: 是否显示圆形标记
            show_heatmap: 是否显示热力图层
            heatmap_radius: 热力图半径
        """
        self.map = folium.Map(
            location=[self.center_lat, self.center_lon],
            zoom_start=self.zoom_start
        )
        
        self._create_colormap()
        
        if show_markers:
            for idx, row in self.df.iterrows():
                lat = row[self.lat_col]
                lon = row[self.lon_col]
                value = row[self.value_col]
                
                norm_val = self._normalize_value(value)
                radius = min_radius + norm_val * (max_radius - min_radius)
                color = self._get_color(value)
                
                folium.CircleMarker(
                    location=[lat, lon],
                    radius=radius,
                    popup=f'{self.value_col}: {value}',
                    color=color,
                    fill=True,
                    fill_color=color,
                    fill_opacity=opacity
                ).add_to(self.map)
        
        if show_heatmap:
            heat_data = [
                [row[self.lat_col], row[self.lon_col], row[self.value_col]] 
                for idx, row in self.df.iterrows()
            ]
            HeatMap(heat_data, radius=heatmap_radius).add_to(self.map)
        
        return self
        
    def add_legend(self, title='数值', position='bottomright'):
        """
        添加图例到地图
        
        Args:
            title: 图例标题
            position: 位置 ('topright', 'topleft', 'bottomright', 'bottomleft')
        """
        if self.map is None:
            raise ValueError("请先调用 create_map() 创建地图")
            
        if self.colormap is None:
            self._create_colormap()
            
        self.colormap.caption = title
        self.colormap.add_to(self.map)
        
        return self
        
    def save_html(self, output_path='map.html'):
        """
        保存地图为 HTML 文件
        
        Args:
            output_path: 输出文件路径
        """
        if self.map is None:
            raise ValueError("请先调用 create_map() 创建地图")
            
        self.map.save(output_path)
        print(f'地图已保存到 {output_path}')
        return self
        
    def export_png(self, output_path='map.png', width=1920, height=1080, wait_time=3):
        """
        使用 Selenium 将地图导出为 PNG 图片
        
        Args:
            output_path: 输出 PNG 文件路径
            width: 截图宽度
            height: 截图高度
            wait_time: 等待地图加载的时间（秒）
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
        except ImportError:
            raise ImportError("请安装 selenium: pip install selenium")
            
        if self.map is None:
            raise ValueError("请先调用 create_map() 创建地图")
            
        temp_html = 'temp_map_export.html'
        self.save_html(temp_html)
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument(f'--window-size={width},{height}')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        driver = None
        try:
            driver = webdriver.Chrome(options=chrome_options)
            
            abs_path = os.path.abspath(temp_html)
            driver.get(f'file://{abs_path}')
            
            time.sleep(wait_time)
            
            driver.save_screenshot(output_path)
            print(f'PNG 图片已保存到 {output_path}')
            
        except Exception as e:
            print(f"导出 PNG 时出错: {e}")
            print("请确保已安装 ChromeDriver: https://sites.google.com/chromium.org/driver/")
            raise
        finally:
            if driver:
                driver.quit()
            if os.path.exists(temp_html):
                os.remove(temp_html)
                
        return self
        
    def get_map(self):
        """获取 Folium 地图对象"""
        return self.map
        
    @staticmethod
    def generate_sample_data(csv_path='sample_data.csv', num_points=100):
        """
        生成示例 CSV 数据
        
        Args:
            csv_path: 输出 CSV 文件路径
            num_points: 数据点数量
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


def quick_start():
    """快速开始示例"""
    GeoViz.generate_sample_data('sample_data.csv', 100)
    
    viz = GeoViz('sample_data.csv')
    viz.set_zoom(8)
    viz.set_color_scheme('viridis')
    viz.create_map(show_markers=True, show_heatmap=True)
    viz.add_legend(title='数值大小')
    viz.save_html('my_map.html')
    
    try:
        viz.export_png('my_map.png', width=1920, height=1080)
    except Exception as e:
        print(f"PNG 导出跳过（需要配置 Selenium）: {e}")
        
    print("完成！在浏览器中打开 my_map.html 查看地图")


if __name__ == '__main__':
    quick_start()
