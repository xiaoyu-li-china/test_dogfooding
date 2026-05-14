#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(not(feature = "std"))]
extern crate alloc;
#[cfg(not(feature = "std"))]
use alloc::vec;
#[cfg(not(feature = "std"))]
use alloc::vec::Vec;

use core::ops::{Add, Mul};
use matrix_core::Matrix;
use num_traits::{Float, Zero, One};

#[derive(Debug, Clone, PartialEq)]
pub struct SparseMatrix<T: Float + Zero + One> {
    rows: usize,
    cols: usize,
    row_indices: Vec<usize>,
    col_indices: Vec<usize>,
    values: Vec<T>,
}

impl<T: Float + Zero + One> SparseMatrix<T> {
    pub fn new(rows: usize, cols: usize) -> Self {
        SparseMatrix {
            rows,
            cols,
            row_indices: Vec::new(),
            col_indices: Vec::new(),
            values: Vec::new(),
        }
    }

    pub fn with_capacity(rows: usize, cols: usize, capacity: usize) -> Self {
        SparseMatrix {
            rows,
            cols,
            row_indices: Vec::with_capacity(capacity),
            col_indices: Vec::with_capacity(capacity),
            values: Vec::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, row: usize, col: usize, value: T) {
        assert!(row < self.rows, "Row index out of bounds");
        assert!(col < self.cols, "Column index out of bounds");
        if value != T::zero() {
            self.row_indices.push(row);
            self.col_indices.push(col);
            self.values.push(value);
        }
    }

    pub fn nnz(&self) -> usize {
        self.values.len()
    }

    pub fn to_dense(&self) -> Matrix<T> {
        let mut dense = Matrix::zeros(self.rows, self.cols);
        for i in 0..self.nnz() {
            let row = self.row_indices[i];
            let col = self.col_indices[i];
            let val = self.values[i];
            dense.set(row, col, val);
        }
        dense
    }

    pub fn from_dense(dense: &Matrix<T>) -> Self {
        let mut sparse = SparseMatrix::with_capacity(dense.rows, dense.cols, dense.rows * dense.cols);
        for i in 0..dense.rows {
            for j in 0..dense.cols {
                let val = dense.get(i, j);
                if val != T::zero() {
                    sparse.push(i, j, val);
                }
            }
        }
        sparse
    }

    pub fn transpose(&self) -> Self {
        let mut result = SparseMatrix::with_capacity(self.cols, self.rows, self.nnz());
        for i in 0..self.nnz() {
            result.push(self.col_indices[i], self.row_indices[i], self.values[i]);
        }
        result
    }
}

impl<T: Float + Zero + One> Add for SparseMatrix<T> {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        assert_eq!(self.rows, other.rows, "Row count mismatch");
        assert_eq!(self.cols, other.cols, "Column count mismatch");

        let mut result = SparseMatrix::with_capacity(self.rows, self.cols, self.nnz() + other.nnz());
        
        for i in 0..self.nnz() {
            result.push(self.row_indices[i], self.col_indices[i], self.values[i]);
        }
        
        for i in 0..other.nnz() {
            result.push(other.row_indices[i], other.col_indices[i], other.values[i]);
        }
        
        result
    }
}

impl<T: Float + Zero + One> Mul for SparseMatrix<T> {
    type Output = Self;

    fn mul(self, other: Self) -> Self {
        assert_eq!(self.cols, other.rows, "Dimension mismatch");

        let mut result = SparseMatrix::new(self.rows, other.cols);
        let mut temp = vec![T::zero(); other.cols];

        for i in 0..self.rows {
            for j in 0..other.cols {
                temp[j] = T::zero();
            }

            for a_idx in 0..self.nnz() {
                if self.row_indices[a_idx] != i {
                    continue;
                }
                let k = self.col_indices[a_idx];
                let a_val = self.values[a_idx];

                for b_idx in 0..other.nnz() {
                    if other.row_indices[b_idx] != k {
                        continue;
                    }
                    let j = other.col_indices[b_idx];
                    temp[j] = temp[j] + a_val * other.values[b_idx];
                }
            }

            for j in 0..other.cols {
                if temp[j] != T::zero() {
                    result.push(i, j, temp[j]);
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
    fn test_sparse_matrix_basic() {
        let mut sparse = SparseMatrix::new(3, 3);
        sparse.push(0, 0, 1.0);
        sparse.push(1, 1, 2.0);
        sparse.push(2, 2, 3.0);
        
        assert_eq!(sparse.nnz(), 3);
        
        let dense = sparse.to_dense();
        assert_eq!(dense.get(0, 0), 1.0);
        assert_eq!(dense.get(1, 1), 2.0);
        assert_eq!(dense.get(2, 2), 3.0);
    }

    #[test]
    fn test_sparse_addition() {
        let mut a = SparseMatrix::new(2, 2);
        a.push(0, 0, 1.0);
        a.push(1, 1, 4.0);
        
        let mut b = SparseMatrix::new(2, 2);
        b.push(0, 1, 2.0);
        b.push(1, 0, 3.0);
        
        let c = a + b;
        assert_eq!(c.nnz(), 4);
        
        let dense = c.to_dense();
        assert_eq!(dense.data, vec![1.0, 2.0, 3.0, 4.0]);
    }

    #[test]
    fn test_sparse_multiplication() {
        let mut a = SparseMatrix::new(2, 2);
        a.push(0, 0, 1.0);
        a.push(0, 1, 2.0);
        a.push(1, 0, 3.0);
        a.push(1, 1, 4.0);
        
        let mut b = SparseMatrix::new(2, 2);
        b.push(0, 0, 5.0);
        b.push(0, 1, 6.0);
        b.push(1, 0, 7.0);
        b.push(1, 1, 8.0);
        
        let c = a * b;
        let dense_c = c.to_dense();
        assert_eq!(dense_c.data, vec![19.0, 22.0, 43.0, 50.0]);
    }

    #[test]
    fn test_sparse_dense_conversion() {
        let dense = Matrix::new(2, 2, vec![1.0, 0.0, 0.0, 4.0]);
        let sparse = SparseMatrix::from_dense(&dense);
        assert_eq!(sparse.nnz(), 2);
        
        let dense2 = sparse.to_dense();
        assert_eq!(dense, dense2);
    }

    #[test]
    fn test_sparse_transpose() {
        let mut sparse = SparseMatrix::new(2, 3);
        sparse.push(0, 0, 1.0);
        sparse.push(0, 2, 3.0);
        sparse.push(1, 1, 5.0);
        
        let transposed = sparse.transpose();
        assert_eq!(transposed.rows, 3);
        assert_eq!(transposed.cols, 2);
        assert_eq!(transposed.nnz(), 3);
        
        let dense = transposed.to_dense();
        assert_eq!(dense.get(0, 0), 1.0);
        assert_eq!(dense.get(2, 0), 3.0);
        assert_eq!(dense.get(1, 1), 5.0);
    }
}
