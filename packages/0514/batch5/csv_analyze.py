#!/usr/bin/env python3
import argparse
import json
import sys
import pandas as pd
from abc import ABC, abstractmethod
from collections import Counter


class StatsPlugin(ABC):
    @abstractmethod
    def can_handle(self, series):
        pass

    @abstractmethod
    def calculate(self, series):
        pass


class NumericalStats(StatsPlugin):
    def can_handle(self, series):
        try:
            pd.to_numeric(series.dropna().astype(str))
            return True
        except (ValueError, TypeError):
            return False

    def calculate(self, series):
        numeric_values = pd.to_numeric(series.dropna().astype(str))
        return {
            "type": "numeric",
            "count": len(numeric_values),
            "min": float(numeric_values.min()),
            "max": float(numeric_values.max()),
            "mean": float(numeric_values.mean()),
            "median": float(numeric_values.median())
        }


class CategoricalStats(StatsPlugin):
    def can_handle(self, series):
        return True

    def calculate(self, series):
        column_values = series.dropna().astype(str)
        column_values = column_values[column_values.str.strip() != '']
        
        if len(column_values) == 0:
            return {"type": "empty", "count": 0}
        
        counter = Counter(column_values)
        most_common = counter.most_common(1)[0]
        return {
            "type": "categorical",
            "count": len(column_values),
            "unique_count": len(counter),
            "most_frequent": most_common[0],
            "most_frequent_count": most_common[1]
        }


class StatsCalculator:
    def __init__(self):
        self.plugins = []

    def register_plugin(self, plugin):
        self.plugins.append(plugin)

    def calculate_column(self, series):
        for plugin in self.plugins:
            if plugin.can_handle(series):
                return plugin.calculate(series)
        return {"type": "unknown", "count": 0}


def get_default_calculator():
    calculator = StatsCalculator()
    calculator.register_plugin(NumericalStats())
    calculator.register_plugin(CategoricalStats())
    return calculator


def analyze_dataframe(df, calculator=None):
    if calculator is None:
        calculator = get_default_calculator()
    
    results = {}
    for column in df.columns:
        results[column] = calculator.calculate_column(df[column])
    return results


def print_human_readable(results, groupby=None):
    if groupby:
        for group_value, group_stats in results.items():
            print(f"\n{'='*50}")
            print(f"分组: {groupby} = {group_value}")
            print(f"{'='*50}")
            _print_single_group(group_stats)
    else:
        _print_single_group(results)


def _print_single_group(stats):
    for column, col_stats in stats.items():
        print(f"\n=== {column} ===")
        print(f"类型: {col_stats['type']}")
        print(f"有效数量: {col_stats['count']}")

        if col_stats['type'] == 'numeric':
            print(f"最小值: {col_stats['min']}")
            print(f"最大值: {col_stats['max']}")
            print(f"均值: {col_stats['mean']:.4f}")
            print(f"中位数: {col_stats['median']}")
        elif col_stats['type'] == 'categorical':
            print(f"唯一值数量: {col_stats['unique_count']}")
            print(f"最高频值: {col_stats['most_frequent']} (出现 {col_stats['most_frequent_count']} 次)")


def main():
    parser = argparse.ArgumentParser(description='CSV 文件数据分析工具')
    parser.add_argument('file', help='要分析的 CSV 文件路径')
    parser.add_argument('--output', choices=['json'], help='输出格式（支持 json）')
    parser.add_argument('--filter', help='数据过滤条件，使用 pandas.query 语法，如 "age > 25"')
    parser.add_argument('--groupby', help='分组统计的列名')

    args = parser.parse_args()

    try:
        df = pd.read_csv(args.file, dtype=str)

        if args.filter:
            for col in df.columns:
                try:
                    df[col] = pd.to_numeric(df[col])
                except (ValueError, TypeError):
                    pass
            df = df.query(args.filter)

        if args.groupby:
            if args.groupby not in df.columns:
                print(f"错误: 分组列 '{args.groupby}' 不存在", file=sys.stderr)
                sys.exit(1)
            
            results = {}
            for group_value, group_df in df.groupby(args.groupby):
                results[str(group_value)] = analyze_dataframe(group_df)
        else:
            results = analyze_dataframe(df)

        if args.output == 'json':
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            print_human_readable(results, args.groupby)

    except FileNotFoundError:
        print(f"错误: 文件 '{args.file}' 不存在", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
