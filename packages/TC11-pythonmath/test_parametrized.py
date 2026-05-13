import pytest
import numpy as np
import time
from matrix import Matrix


REL_TOL = 1e-8


def matrices_almost_equal(mat_custom, mat_numpy, rel_tol=REL_TOL):
    if mat_custom.shape != mat_numpy.shape:
        return False
    for i in range(mat_custom.rows):
        for j in range(mat_custom.cols):
            a = mat_custom[i][j]
            b = mat_numpy[i, j]
            if abs(a) < 1e-10 and abs(b) < 1e-10:
                continue
            if abs(a - b) > rel_tol * max(abs(a), abs(b), 1e-10):
                return False
    return True


def scalars_almost_equal(a, b, rel_tol=REL_TOL):
    if abs(a) < 1e-10 and abs(b) < 1e-10:
        return True
    return abs(a - b) <= rel_tol * max(abs(a), abs(b), 1e-10)


MULTIPLY_CASES = [
    (
        [[1, 2], [3, 4]],
        [[5, 6], [7, 8]],
        "2x2 * 2x2 整数矩阵"
    ),
    (
        [[1.5, 2.5], [3.5, 4.5]],
        [[5.5, 6.5], [7.5, 8.5]],
        "2x2 * 2x2 浮点矩阵"
    ),
    (
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8], [9, 10], [11, 12]],
        "2x3 * 3x2 长方形矩阵"
    ),
    (
        [[1, 2], [3, 4], [5, 6]],
        [[7, 8, 9], [10, 11, 12]],
        "3x2 * 2x3 长方形矩阵"
    ),
    (
        [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        "单位矩阵 * 3x3 矩阵"
    ),
    (
        [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        "3x3 矩阵 * 单位矩阵"
    ),
    (
        [[1, 2], [3, 4]],
        [[0, 0], [0, 0]],
        "矩阵 * 零矩阵"
    ),
    (
        [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
        [[16, 15, 14, 13], [12, 11, 10, 9], [8, 7, 6, 5], [4, 3, 2, 1]],
        "4x4 * 4x4 矩阵"
    ),
    (
        [[1e-5, 2e-5], [3e-5, 4e-5]],
        [[5, 6], [7, 8]],
        "小数矩阵乘法"
    ),
    (
        [[1, 2, 3], [4, 5, 6]],
        [[0.1], [0.2], [0.3]],
        "2x3 * 3x1 列向量"
    ),
]


DETERMINANT_CASES = [
    ([[5]], "1x1 矩阵"),
    ([[1, 2], [3, 4]], "2x2 矩阵 (det = -2)"),
    ([[1, 2], [2, 4]], "2x2 奇异矩阵 (det = 0)"),
    ([[1, 2, 3], [4, 5, 6], [7, 8, 10]], "3x3 矩阵 (det = -3)"),
    ([[1, 2, 3], [4, 5, 6], [7, 8, 9]], "3x3 奇异矩阵 (det = 0)"),
    ([[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 3, 0], [0, 0, 0, 4]], "4x4 对角矩阵 (det = 24)"),
    ([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 17]], "4x4 矩阵"),
    ([[1, 1, 1, 1], [1, 2, 4, 8], [1, 3, 9, 27], [1, 4, 16, 64]], "4x4 范德蒙德矩阵"),
    ([[2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0], [0, 0, 0, 2]], "4x4 标量矩阵 (det = 16)"),
    ([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], "4x4 单位矩阵 (det = 1)"),
    ([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20], [21, 22, 23, 24, 25]], "5x5 奇异矩阵 (行线性相关)"),
    ([[1, 1, 1, 1, 1], [1, 2, 4, 8, 16], [1, 3, 9, 27, 81], [1, 4, 16, 64, 256], [1, 5, 25, 125, 625]], "5x5 范德蒙德矩阵"),
    ([[1e-5, 2e-5], [3e-5, 5e-5]], "2x2 小数行列式 (det = -1e-10)"),
]


@pytest.mark.parametrize("a_data, b_data, description", MULTIPLY_CASES, ids=[c[2] for c in MULTIPLY_CASES])
def test_matrix_multiply_vs_numpy(a_data, b_data, description):
    a_custom = Matrix(a_data)
    b_custom = Matrix(b_data)
    result_custom = a_custom * b_custom
    
    a_np = np.array(a_data, dtype=float)
    b_np = np.array(b_data, dtype=float)
    result_np = a_np @ b_np
    
    assert matrices_almost_equal(result_custom, result_np), f"{description}: 结果不匹配\n自定义: {result_custom}\nNumPy: {result_np}"


@pytest.mark.parametrize("data, description", DETERMINANT_CASES, ids=[c[1] for c in DETERMINANT_CASES])
def test_determinant_vs_numpy(data, description):
    m_custom = Matrix(data)
    det_custom = m_custom.determinant()
    
    m_np = np.array(data, dtype=float)
    det_np = np.linalg.det(m_np)
    
    assert scalars_almost_equal(det_custom, det_np), f"{description}: 行列式不匹配\n自定义: {det_custom}\nNumPy: {det_np}"


def test_singular_matrix_determinant_zero():
    singular_data = [[1, 2, 3], [2, 4, 6], [3, 6, 9]]
    m = Matrix(singular_data)
    det = m.determinant()
    
    m_np = np.array(singular_data, dtype=float)
    det_np = np.linalg.det(m_np)
    
    assert abs(det) < 1e-8, f"奇异矩阵行列式应为 0，得到: {det}"
    assert scalars_almost_equal(det, det_np)


@pytest.mark.performance
def test_100x100_matrix_multiply_performance():
    np.random.seed(42)
    size = 100
    data_a = np.random.rand(size, size).tolist()
    data_b = np.random.rand(size, size).tolist()
    
    a_custom = Matrix(data_a)
    b_custom = Matrix(data_b)
    
    start = time.time()
    result_custom = a_custom * b_custom
    custom_time = time.time() - start
    
    a_np = np.array(data_a, dtype=float)
    b_np = np.array(data_b, dtype=float)
    
    start = time.time()
    result_np = a_np @ b_np
    numpy_time = time.time() - start
    
    print(f"\n100x100 矩阵乘法性能:")
    print(f"  自定义实现: {custom_time * 1000:.2f} ms")
    print(f"  NumPy:       {numpy_time * 1000:.2f} ms")
    print(f"  倍数:       {custom_time / max(numpy_time, 1e-9):.1f}x")
    
    assert matrices_almost_equal(result_custom, result_np)
    
    assert custom_time < 10.0, f"性能过慢: {custom_time * 1000:.2f} ms"


@pytest.mark.performance
def test_100x100_determinant_performance():
    np.random.seed(42)
    size = 100
    data = np.random.rand(size, size).tolist()
    
    m_custom = Matrix(data)
    
    start = time.time()
    det_custom = m_custom.determinant()
    custom_time = time.time() - start
    
    m_np = np.array(data, dtype=float)
    
    start = time.time()
    det_np = np.linalg.det(m_np)
    numpy_time = time.time() - start
    
    print(f"\n100x100 行列式计算性能:")
    print(f"  自定义实现: {custom_time * 1000:.2f} ms")
    print(f"  NumPy:       {numpy_time * 1000:.2f} ms")
    print(f"  倍数:       {custom_time / max(numpy_time, 1e-9):.1f}x")
    
    assert scalars_almost_equal(det_custom, det_np)
    
    assert custom_time < 5.0, f"性能过慢: {custom_time * 1000:.2f} ms"


@pytest.mark.performance
def test_determinant_cache_performance():
    np.random.seed(42)
    size = 50
    data = np.random.rand(size, size).tolist()
    
    m = Matrix(data)
    
    start = time.time()
    det1 = m.determinant()
    first_time = time.time() - start
    
    start = time.time()
    det2 = m.determinant()
    cached_time = time.time() - start
    
    start = time.time()
    det3 = m.determinant()
    second_cached_time = time.time() - start
    
    print(f"\n50x50 行列式缓存性能:")
    print(f"  首次计算: {first_time * 1000:.2f} ms")
    print(f"  缓存调用 1: {cached_time * 1000:.4f} ms")
    print(f"  缓存调用 2: {second_cached_time * 1000:.4f} ms")
    print(f"  加速比:    {first_time / max(cached_time, 1e-9):.1f}x")
    
    assert det1 == det2 == det3
    
    assert cached_time < first_time * 0.1, "缓存效果不明显"


def test_relative_error_tolerance():
    data = [[1, 2, 3], [4, 5, 6], [7, 8, 10]]
    m = Matrix(data)
    det_custom = m.determinant()
    
    m_np = np.array(data, dtype=float)
    det_np = np.linalg.det(m_np)
    
    abs_error = abs(det_custom - det_np)
    rel_error = abs_error / max(abs(det_np), 1e-10)
    
    print(f"\n相对误差测试:")
    print(f"  自定义行列式: {det_custom}")
    print(f"  NumPy 行列式: {det_np}")
    print(f"  绝对误差:    {abs_error}")
    print(f"  相对误差:    {rel_error}")
    
    assert rel_error < REL_TOL, f"相对误差 {rel_error} 超过容限 {REL_TOL}"
