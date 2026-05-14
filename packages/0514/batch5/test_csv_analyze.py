import pytest
import pandas as pd
import json
import tempfile
import os
from io import StringIO
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import csv_analyze


def test_numeric_stats():
    csv_content = """value
1
2
3
4
5
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --output json').read()
        stats = json.loads(result)
        
        df = pd.read_csv(temp_file)
        
        assert stats['value']['type'] == 'numeric'
        assert stats['value']['min'] == df['value'].min()
        assert stats['value']['max'] == df['value'].max()
        assert abs(stats['value']['mean'] - df['value'].mean()) < 1e-10
        assert abs(stats['value']['median'] - df['value'].median()) < 1e-10
    finally:
        os.unlink(temp_file)


def test_categorical_stats():
    csv_content = """category
A
B
A
C
A
B
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --output json').read()
        stats = json.loads(result)
        
        df = pd.read_csv(temp_file)
        
        assert stats['category']['type'] == 'categorical'
        assert stats['category']['unique_count'] == df['category'].nunique()
        assert stats['category']['most_frequent'] == df['category'].mode().iloc[0]
    finally:
        os.unlink(temp_file)


def test_missing_values():
    csv_content = """value,category
1,A
,
3,
,B
5,C
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --output json').read()
        stats = json.loads(result)
        
        assert stats['value']['count'] == 3
        assert stats['category']['count'] == 3
    finally:
        os.unlink(temp_file)


def test_scientific_notation():
    csv_content = """value
1e3
2.5e2
3e1
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --output json').read()
        stats = json.loads(result)
        
        df = pd.read_csv(temp_file)
        
        assert stats['value']['type'] == 'numeric'
        assert abs(stats['value']['min'] == 30.0)
        assert abs(stats['value']['max'] == 1000.0)
    finally:
        os.unlink(temp_file)


def test_filter_function():
    csv_content = """name,age,score
张三,25,85
李四,30,92
王五,28,78
赵六,35,88
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --filter "age > 28" --output json').read()
        stats = json.loads(result)
        
        assert stats['age']['count'] == 2
        assert stats['age']['min'] == 30.0
        assert stats['age']['max'] == 35.0
    finally:
        os.unlink(temp_file)


def test_groupby_function():
    csv_content = """city,value
A,10
A,20
B,30
B,40
B,50
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --groupby city --output json').read()
        stats = json.loads(result)
        
        assert 'A' in stats
        assert 'B' in stats
        assert stats['A']['value']['count'] == 2
        assert stats['B']['value']['count'] == 3
        assert stats['A']['value']['mean'] == 15.0
        assert stats['B']['value']['mean'] == 40.0
    finally:
        os.unlink(temp_file)


def test_mixed_types():
    csv_content = """numeric,category,date
1,foo,2024-01-01
2,bar,2024-01-02
3,foo,2024-01-03
4,baz,2024-01-04
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_file = f.name
    
    try:
        result = os.popen(f'python3 csv_analyze.py {temp_file} --output json').read()
        stats = json.loads(result)
        
        assert stats['numeric']['type'] == 'numeric'
        assert stats['category']['type'] == 'categorical'
        assert stats['date']['type'] == 'categorical'
    finally:
        os.unlink(temp_file)
