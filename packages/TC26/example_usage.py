"""
GeoViz 类使用示例
"""
from geoviz import GeoViz
import pandas as pd
import numpy as np


def example_basic():
    """基础用法示例"""
    print("=== 基础用法示例 ===")
    
    GeoViz.generate_sample_data('data_basic.csv', 80)
    
    viz = GeoViz('data_basic.csv')
    viz.create_map()
    viz.add_legend(title='数值')
    viz.save_html('map_basic.html')
    
    print("完成！查看 map_basic.html")
    print()


def example_custom_config():
    """自定义配置示例"""
    print("=== 自定义配置示例 ===")
    
    GeoViz.generate_sample_data('data_custom.csv', 100)
    
    viz = GeoViz('data_custom.csv')
    viz.set_map_center(35.0, 115.0)
    viz.set_zoom(7)
    viz.set_color_scheme('plasma')
    
    viz.create_map(
        min_radius=3,
        max_radius=40,
        opacity=0.7,
        show_markers=True,
        show_heatmap=True,
        heatmap_radius=20
    )
    
    viz.add_legend(title='数据值', position='bottomleft')
    viz.save_html('map_custom.html')
    
    print("完成！查看 map_custom.html")
    print()


def example_color_schemes():
    """颜色方案示例"""
    print("=== 颜色方案示例 ===")
    
    GeoViz.generate_sample_data('data_colors.csv', 60)
    
    schemes = ['viridis', 'plasma', 'coolwarm', 'red_blue', 'green_red']
    
    for scheme in schemes:
        viz = GeoViz('data_colors.csv')
        viz.set_color_scheme(scheme)
        viz.create_map(show_heatmap=False)
        viz.add_legend(title=scheme)
        viz.save_html(f'map_color_{scheme}.html')
        print(f"已生成 map_color_{scheme}.html")
    
    print()


def example_from_dataframe():
    """从 DataFrame 创建示例"""
    print("=== 从 DataFrame 创建示例 ===")
    
    np.random.seed(123)
    n_points = 50
    
    data = {
        'lat': np.random.uniform(31, 32, n_points),
        'lng': np.random.uniform(120, 121, n_points),
        'weight': np.random.randint(10, 200, n_points)
    }
    df = pd.DataFrame(data)
    
    viz = GeoViz(
        df=df,
        lat_col='lat',
        lon_col='lng',
        value_col='weight'
    )
    
    viz.set_color_scheme('coolwarm')
    viz.create_map()
    viz.add_legend(title='权重')
    viz.save_html('map_dataframe.html')
    
    print("完成！查看 map_dataframe.html")
    print()


def example_export_png():
    """导出 PNG 示例（需要 ChromeDriver）"""
    print("=== PNG 导出示例 ===")
    print("注意：需要安装 ChromeDriver")
    
    try:
        GeoViz.generate_sample_data('data_png.csv', 40)
        
        viz = GeoViz('data_png.csv')
        viz.set_zoom(8)
        viz.create_map()
        viz.add_legend(title='数值')
        
        viz.export_png(
            'map_export.png',
            width=1600,
            height=900,
            wait_time=4
        )
        
        print("PNG 导出成功！")
    except Exception as e:
        print(f"PNG 导出跳过: {e}")
        print("如需导出 PNG，请安装 ChromeDriver:")
        print("https://sites.google.com/chromium.org/driver/")
    print()


def example_heatmap_only():
    """仅热力图示例"""
    print("=== 仅热力图示例 ===")
    
    GeoViz.generate_sample_data('data_heatmap.csv', 200)
    
    viz = GeoViz('data_heatmap.csv')
    viz.set_color_scheme('viridis')
    viz.create_map(
        show_markers=False,
        show_heatmap=True,
        heatmap_radius=25
    )
    viz.add_legend(title='密度')
    viz.save_html('map_heatmap_only.html')
    
    print("完成！查看 map_heatmap_only.html")
    print()


def example_markers_only():
    """仅标记示例"""
    print("=== 仅标记示例 ===")
    
    GeoViz.generate_sample_data('data_markers.csv', 80)
    
    viz = GeoViz('data_markers.csv')
    viz.set_color_scheme('purple_orange')
    viz.create_map(
        show_markers=True,
        show_heatmap=False,
        min_radius=6,
        max_radius=35,
        opacity=0.8
    )
    viz.add_legend(title='数值')
    viz.save_html('map_markers_only.html')
    
    print("完成！查看 map_markers_only.html")
    print()


def main():
    """运行所有示例"""
    print("GeoViz 类使用示例")
    print("=" * 50)
    print()
    
    example_basic()
    example_custom_config()
    example_color_schemes()
    example_from_dataframe()
    example_heatmap_only()
    example_markers_only()
    example_export_png()
    
    print("=" * 50)
    print("所有示例运行完成！")
    print("可用的颜色方案: viridis, plasma, coolwarm, red_blue,")
    print("                green_red, blue_green_red, yellow_red, purple_orange")


if __name__ == '__main__':
    main()
