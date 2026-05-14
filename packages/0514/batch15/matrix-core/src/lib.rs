#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(not(feature = "std"))]
extern crate alloc;
#[cfg(not(feature = "std"))]
use alloc::vec;
#[cfg(not(feature = "std"))]
use alloc::vec::Vec;

use core::ops::{Add, Mul};
use num_traits::{Float, Zero, One};

#[derive(Debug, Clone, PartialEq)]
pub struct Matrix<T: Float + Zero + One> {
    pub rows: usize,
    pub cols: usize,
    pub data: Vec<T>,
}

impl<T: Float + Zero + One> Matrix<T> {
    pub fn new(rows: usize, cols: usize, data: Vec<T>) -> Self {
        assert_eq!(data.len(), rows * cols, "Data length mismatch");
        Matrix { rows, cols, data }
    }

    pub fn zeros(rows: usize, cols: usize) -> Self {
        Matrix {
            rows,
            cols,
            data: vec![T::zero(); rows * cols],
        }
    }

    pub fn identity(n: usize) -> Self {
        let mut data = vec![T::zero(); n * n];
        for i in 0..n {
            data[i * n + i] = T::one();
        }
        Matrix { rows: n, cols: n, data }
    }

    pub fn get(&self, row: usize, col: usize) -> T {
        self.data[row * self.cols + col]
    }

    pub fn set(&mut self, row: usize, col: usize, value: T) {
        self.data[row * self.cols + col] = value;
    }

    pub fn transpose(&self) -> Self {
        let mut result = Matrix::zeros(self.cols, self.rows);
        for i in 0..self.rows {
            for j in 0..self.cols {
                result.set(j, i, self.get(i, j));
            }
        }
        result
    }

    fn lu_decompose(&self) -> Option<(Matrix<T>, Matrix<T>, isize)> {
        if self.rows != self.cols {
            return None;
        }
        let n = self.rows;
        if n == 0 {
            return None;
        }
        
        let mut lu = self.clone();
        let mut permutations = 0;

        for k in 0..n {
            let mut pivot_row = k;
            let mut pivot_val = lu.get(k, k).abs();
            
            for i in (k + 1)..n {
                let val = lu.get(i, k).abs();
                if val > pivot_val {
                    pivot_val = val;
                    pivot_row = i;
                }
            }

            if pivot_val < T::epsilon() {
                return None;
            }

            if pivot_row != k {
                for j in 0..n {
                    let temp = lu.get(k, j);
                    lu.set(k, j, lu.get(pivot_row, j));
                    lu.set(pivot_row, j, temp);
                }
                permutations += 1;
            }

            for i in (k + 1)..n {
                let factor = lu.get(i, k) / lu.get(k, k);
                lu.set(i, k, factor);
                for j in (k + 1)..n {
                    let val = lu.get(i, j) - factor * lu.get(k, j);
                    lu.set(i, j, val);
                }
            }
        }

        let mut l = Matrix::identity(n);
        let mut u = Matrix::zeros(n, n);
        
        for i in 0..n {
            for j in 0..n {
                if i > j {
                    l.set(i, j, lu.get(i, j));
                } else {
                    u.set(i, j, lu.get(i, j));
                }
            }
        }

        Some((l, u, permutations))
    }

    pub fn determinant(&self) -> Option<T> {
        let (_, u, perm) = self.lu_decompose()?;
        let mut det = if perm % 2 == 0 { T::one() } else { -T::one() };
        for i in 0..self.rows {
            det = det * u.get(i, i);
        }
        Some(det)
    }
}

impl<T: Float + Zero + One> Add for Matrix<T> {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        assert_eq!(self.rows, other.rows, "Row count mismatch");
        assert_eq!(self.cols, other.cols, "Column count mismatch");
        
        let data: Vec<T> = self.data
            .iter()
            .zip(other.data.iter())
            .map(|(a, b)| *a + *b)
            .collect();
        
        Matrix::new(self.rows, self.cols, data)
    }
}

impl<T: Float + Zero + One> Mul for Matrix<T> {
    type Output = Self;

    fn mul(self, other: Self) -> Self {
        assert_eq!(self.cols, other.rows, "Dimension mismatch");
        
        let mut result = Matrix::zeros(self.rows, other.cols);
        
        for i in 0..self.rows {
            for k in 0..self.cols {
                let a_ik = self.get(i, k);
                for j in 0..other.cols {
                    let val = result.get(i, j) + a_ik * other.get(k, j);
                    result.set(i, j, val);
                }
            }
        }
        
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matrix_addition() {
        let a = Matrix::new(2, 2, vec![1.0, 2.0, 3.0, 4.0]);
        let b = Matrix::new(2, 2, vec![5.0, 6.0, 7.0, 8.0]);
        let c = a + b;
        assert_eq!(c.data, vec![6.0, 8.0, 10.0, 12.0]);
    }

    #[test]
    fn test_matrix_multiplication() {
        let a = Matrix::new(2, 2, vec![1.0, 2.0, 3.0, 4.0]);
        let b = Matrix::new(2, 2, vec![5.0, 6.0, 7.0, 8.0]);
        let c = a * b;
        assert_eq!(c.data, vec![19.0, 22.0, 43.0, 50.0]);
    }

    #[test]
    fn test_transpose() {
        let a = Matrix::new(2, 3, vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
        let b = a.transpose();
        assert_eq!(b.rows, 3);
        assert_eq!(b.cols, 2);
        assert_eq!(b.data, vec![1.0, 4.0, 2.0, 5.0, 3.0, 6.0]);
    }

    #[test]
    fn test_determinant() {
        let a = Matrix::new(2, 2, vec![1.0, 2.0, 3.0, 4.0]);
        let det = a.determinant().unwrap();
        assert!((det + 2.0).abs() < 1e-9);
    }

    #[test]
    fn test_f32_matrix() {
        let a: Matrix<f32> = Matrix::new(2, 2, vec![1.0, 2.0, 3.0, 4.0]);
        let b: Matrix<f32> = Matrix::new(2, 2, vec![5.0, 6.0, 7.0, 8.0]);
        let c = a + b;
        assert_eq!(c.data, vec![6.0, 8.0, 10.0, 12.0]);
    }
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;

    fn generate_matrix_fixed(rows: usize, cols: usize) -> BoxedStrategy<Matrix<f64>> {
        let data_len = rows * cols;
        prop::collection::vec(-100.0..100.0, data_len)
            .prop_map(move |data| Matrix::new(rows, cols, data))
            .boxed()
    }

    proptest! {
        #[test]
        fn test_multiplication_associativity(
            a in generate_matrix_fixed(3, 3),
            b in generate_matrix_fixed(3, 3),
            c in generate_matrix_fixed(3, 3)
        ) {
            let ab = a.clone() * b.clone();
            let abc1 = ab * c.clone();
            
            let bc = b * c;
            let abc2 = a * bc;
            
            for i in 0..3 {
                for j in 0..3 {
                    assert!((abc1.get(i, j) - abc2.get(i, j)).abs() < 1e-6);
                }
            }
        }

        #[test]
        fn test_transpose_involution(mat in generate_matrix_fixed(4, 5)) {
            let transposed = mat.transpose();
            let transposed_twice = transposed.transpose();
            assert_eq!(mat, transposed_twice);
        }

        #[test]
        fn test_transpose_product(
            a in generate_matrix_fixed(3, 4),
            b in generate_matrix_fixed(4, 2)
        ) {
            let ab = a.clone() * b.clone();
            let ab_t = ab.transpose();
            
            let b_t = b.transpose();
            let a_t = a.transpose();
            let b_t_a_t = b_t * a_t;
            
            for i in 0..2 {
                for j in 0..3 {
                    assert!((ab_t.get(i, j) - b_t_a_t.get(i, j)).abs() < 1e-6);
                }
            }
        }
    }
}
