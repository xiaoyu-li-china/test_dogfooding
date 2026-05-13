import unittest
from matrix import Matrix


class TestMatrixCreation(unittest.TestCase):
    def test_create_2x2_matrix(self):
        data = [[1, 2], [3, 4]]
        m = Matrix(data)
        self.assertEqual(m.shape, (2, 2))
        self.assertEqual(m[0][0], 1)
        self.assertEqual(m[0][1], 2)
        self.assertEqual(m[1][0], 3)
        self.assertEqual(m[1][1], 4)
    
    def test_create_3x3_matrix(self):
        data = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
        m = Matrix(data)
        self.assertEqual(m.shape, (3, 3))
    
    def test_create_2x3_matrix(self):
        data = [[1, 2, 3], [4, 5, 6]]
        m = Matrix(data)
        self.assertEqual(m.shape, (2, 3))
    
    def test_invalid_matrix_shape(self):
        with self.assertRaises(ValueError):
            Matrix([[1, 2], [3]])
    
    def test_zeros_matrix(self):
        m = Matrix.zeros(2, 3)
        self.assertEqual(m.shape, (2, 3))
        for i in range(2):
            for j in range(3):
                self.assertEqual(m[i][j], 0.0)
    
    def test_ones_matrix(self):
        m = Matrix.ones(3, 2)
        self.assertEqual(m.shape, (3, 2))
        for i in range(3):
            for j in range(2):
                self.assertEqual(m[i][j], 1.0)
    
    def test_identity_matrix(self):
        m = Matrix.identity(3)
        self.assertEqual(m.shape, (3, 3))
        for i in range(3):
            for j in range(3):
                if i == j:
                    self.assertEqual(m[i][j], 1.0)
                else:
                    self.assertEqual(m[i][j], 0.0)


class TestMatrixAddition(unittest.TestCase):
    def test_add_2x2_matrices(self):
        m1 = Matrix([[1, 2], [3, 4]])
        m2 = Matrix([[5, 6], [7, 8]])
        result = m1 + m2
        expected = Matrix([[6, 8], [10, 12]])
        self.assertEqual(result, expected)
    
    def test_add_3x3_matrices(self):
        m1 = Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        m2 = Matrix([[9, 8, 7], [6, 5, 4], [3, 2, 1]])
        result = m1 + m2
        expected = Matrix([[10, 10, 10], [10, 10, 10], [10, 10, 10]])
        self.assertEqual(result, expected)
    
    def test_add_zero_matrix(self):
        m1 = Matrix([[1, 2], [3, 4]])
        zero = Matrix.zeros(2, 2)
        result = m1 + zero
        self.assertEqual(result, m1)
    
    def test_add_shape_mismatch(self):
        m1 = Matrix([[1, 2], [3, 4]])
        m2 = Matrix([[1, 2, 3], [4, 5, 6]])
        with self.assertRaises(ValueError):
            m1 + m2
    
    def test_add_non_matrix(self):
        m = Matrix([[1, 2], [3, 4]])
        with self.assertRaises(TypeError):
            m + 5


class TestMatrixMultiplication(unittest.TestCase):
    def test_multiply_by_scalar(self):
        m = Matrix([[1, 2], [3, 4]])
        result = m * 2
        expected = Matrix([[2, 4], [6, 8]])
        self.assertEqual(result, expected)
    
    def test_multiply_by_zero_scalar(self):
        m = Matrix([[1, 2], [3, 4]])
        result = m * 0
        expected = Matrix.zeros(2, 2)
        self.assertEqual(result, expected)
    
    def test_scalar_multiplication_reverse(self):
        m = Matrix([[1, 2], [3, 4]])
        result = 2 * m
        expected = Matrix([[2, 4], [6, 8]])
        self.assertEqual(result, expected)
    
    def test_multiply_2x2_matrices(self):
        m1 = Matrix([[1, 2], [3, 4]])
        m2 = Matrix([[5, 6], [7, 8]])
        result = m1 * m2
        expected = Matrix([[19, 22], [43, 50]])
        self.assertEqual(result, expected)
    
    def test_multiply_2x3_and_3x2(self):
        m1 = Matrix([[1, 2, 3], [4, 5, 6]])
        m2 = Matrix([[7, 8], [9, 10], [11, 12]])
        result = m1 * m2
        expected = Matrix([[58, 64], [139, 154]])
        self.assertEqual(result, expected)
    
    def test_multiply_by_identity(self):
        m = Matrix([[1, 2], [3, 4]])
        ident = Matrix.identity(2)
        self.assertEqual(m * ident, m)
        self.assertEqual(ident * m, m)
    
    def test_multiply_by_zero_matrix(self):
        m = Matrix([[1, 2], [3, 4]])
        zero = Matrix.zeros(2, 2)
        expected = Matrix.zeros(2, 2)
        self.assertEqual(m * zero, expected)
        self.assertEqual(zero * m, expected)
    
    def test_multiply_shape_mismatch(self):
        m1 = Matrix([[1, 2], [3, 4]])
        m2 = Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        with self.assertRaises(ValueError):
            m1 * m2


class TestMatrixTranspose(unittest.TestCase):
    def test_transpose_2x2(self):
        m = Matrix([[1, 2], [3, 4]])
        result = m.transpose()
        expected = Matrix([[1, 3], [2, 4]])
        self.assertEqual(result, expected)
    
    def test_transpose_2x3(self):
        m = Matrix([[1, 2, 3], [4, 5, 6]])
        result = m.transpose()
        expected = Matrix([[1, 4], [2, 5], [3, 6]])
        self.assertEqual(result, expected)
        self.assertEqual(result.shape, (3, 2))
    
    def test_transpose_3x3(self):
        m = Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        result = m.transpose()
        expected = Matrix([[1, 4, 7], [2, 5, 8], [3, 6, 9]])
        self.assertEqual(result, expected)
    
    def test_transpose_transpose(self):
        m = Matrix([[1, 2, 3], [4, 5, 6]])
        result = m.transpose().transpose()
        self.assertEqual(result, m)


class TestMatrixDeterminant(unittest.TestCase):
    def test_determinant_1x1(self):
        m = Matrix([[5]])
        self.assertEqual(m.determinant(), 5)
    
    def test_determinant_2x2(self):
        m = Matrix([[1, 2], [3, 4]])
        self.assertEqual(m.determinant(), -2)
    
    def test_determinant_2x2_zero(self):
        m = Matrix([[1, 2], [2, 4]])
        self.assertEqual(m.determinant(), 0)
    
    def test_determinant_3x3(self):
        m = Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 10]])
        self.assertAlmostEqual(m.determinant(), -3)
    
    def test_determinant_3x3_zero(self):
        m = Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        self.assertAlmostEqual(m.determinant(), 0)
    
    def test_determinant_4x4(self):
        m = Matrix([
            [1, 1, 1, 1],
            [1, 2, 4, 8],
            [1, 3, 9, 27],
            [1, 4, 16, 64]
        ])
        self.assertAlmostEqual(m.determinant(), 12)
    
    def test_determinant_identity(self):
        m = Matrix.identity(4)
        self.assertAlmostEqual(m.determinant(), 1)
    
    def test_determinant_scalar_multiple(self):
        m = Matrix.identity(3) * 2
        self.assertAlmostEqual(m.determinant(), 8)
    
    def test_determinant_non_square(self):
        m = Matrix([[1, 2, 3], [4, 5, 6]])
        with self.assertRaises(ValueError):
            m.determinant()


if __name__ == "__main__":
    unittest.main()
