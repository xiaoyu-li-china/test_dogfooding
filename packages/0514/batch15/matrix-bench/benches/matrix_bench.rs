use criterion::{criterion_group, criterion_main, Criterion, black_box};
use matrix_core::Matrix;
use matrix_sparse::SparseMatrix;
use rand::Rng;
use rand::rngs::StdRng;
use rand::SeedableRng;

fn generate_random_matrix(n: usize) -> Matrix<f64> {
    let mut rng = StdRng::seed_from_u64(42);
    let data: Vec<f64> = (0..n*n).map(|_| rng.gen_range(-100.0..100.0)).collect();
    Matrix::new(n, n, data)
}

fn generate_sparse_matrix(n: usize, density: f64) -> SparseMatrix<f64> {
    let mut rng = StdRng::seed_from_u64(42);
    let mut sparse = SparseMatrix::new(n, n);
    for i in 0..n {
        for j in 0..n {
            if rng.gen::<f64>() < density {
                sparse.push(i, j, rng.gen_range(-100.0..100.0));
            }
        }
    }
    sparse
}

fn benchmark_dense_multiplication(c: &mut Criterion) {
    let mut group = c.benchmark_group("Dense Matrix Multiplication");
    
    for &size in &[32, 64, 128] {
        let a = generate_random_matrix(size);
        let b = generate_random_matrix(size);
        
        group.bench_function(format!("size_{}", size), |bencher| {
            bencher.iter(|| {
                black_box(a.clone() * b.clone())
            });
        });
    }
    
    group.finish();
}

fn benchmark_sparse_multiplication(c: &mut Criterion) {
    let mut group = c.benchmark_group("Sparse Matrix Multiplication");
    
    let size = 128;
    for &density in &[0.01, 0.05, 0.1] {
        let a = generate_sparse_matrix(size, density);
        let b = generate_sparse_matrix(size, density);
        
        group.bench_function(format!("density_{}", density), |bencher| {
            bencher.iter(|| {
                black_box(a.clone() * b.clone())
            });
        });
    }
    
    group.finish();
}

fn benchmark_dense_vs_sparse(c: &mut Criterion) {
    let mut group = c.benchmark_group("Dense vs Sparse Comparison");
    
    let size = 64;
    let densities = [0.01, 0.05, 0.1, 0.2, 0.5];
    
    for &density in &densities {
        let dense_a = generate_random_matrix(size);
        let dense_b = generate_random_matrix(size);
        let sparse_a = generate_sparse_matrix(size, density);
        let sparse_b = generate_sparse_matrix(size, density);
        
        group.bench_function(format!("dense_density_{}", density), |bencher| {
            bencher.iter(|| {
                black_box(dense_a.clone() * dense_b.clone())
            });
        });
        
        group.bench_function(format!("sparse_density_{}", density), |bencher| {
            bencher.iter(|| {
                black_box(sparse_a.clone() * sparse_b.clone())
            });
        });
    }
    
    group.finish();
}

fn benchmark_determinant(c: &mut Criterion) {
    let mut group = c.benchmark_group("Matrix Determinant (LU Decomposition)");
    
    for &size in &[8, 16, 32] {
        let a = generate_random_matrix(size);
        
        group.bench_function(format!("size_{}", size), |bencher| {
            bencher.iter(|| {
                black_box(a.determinant())
            });
        });
    }
    
    group.finish();
}

fn benchmark_transpose(c: &mut Criterion) {
    let mut group = c.benchmark_group("Matrix Transpose");
    
    for &size in &[64, 128, 256] {
        let dense = generate_random_matrix(size);
        let sparse = generate_sparse_matrix(size, 0.1);
        
        group.bench_function(format!("dense_size_{}", size), |bencher| {
            bencher.iter(|| {
                black_box(dense.transpose())
            });
        });
        
        group.bench_function(format!("sparse_size_{}", size), |bencher| {
            bencher.iter(|| {
                black_box(sparse.transpose())
            });
        });
    }
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_dense_multiplication,
    benchmark_sparse_multiplication,
    benchmark_dense_vs_sparse,
    benchmark_determinant,
    benchmark_transpose
);
criterion_main!(benches);
