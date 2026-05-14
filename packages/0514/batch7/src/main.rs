use anyhow::Result;
use clap::Parser;
use imgc::{collect_files_recursive, compress_with_format, format_size, CompressionResult, CompressorConfig, CompressorRegistry};
use rayon::prelude::*;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, num_args = 1..)]
    files: Vec<PathBuf>,

    #[arg(short, default_value_t = 4)]
    j: usize,

    #[arg(long)]
    diff: bool,

    #[arg(short, long)]
    config: Option<PathBuf>,

    #[arg(long, default_value = "webp")]
    format: String,

    #[arg(short, long)]
    recursive: bool,
}

fn print_diff_results(results: &[CompressionResult]) {
    println!("\n{:-<100}", "");
    println!(
        "{:<45} {:>15} {:>15} {:>10} {:>10}",
        "File", "Original", "Compressed", "Ratio", "Format"
    );
    println!("{:-<100}", "");

    let mut total_original = 0u64;
    let mut total_compressed = 0u64;
    let mut success_count = 0;

    for r in results {
        if r.success {
            let ratio = if r.original_size > 0 {
                (r.compressed_size as f64 / r.original_size as f64) * 100.0
            } else {
                0.0
            };
            let filename = r.file.file_name().unwrap_or_default().to_string_lossy();
            println!(
                "{:<45} {:>15} {:>15} {:>9.1}% {:>10}",
                filename,
                format_size(r.original_size),
                format_size(r.compressed_size),
                ratio,
                r.format
            );
            total_original += r.original_size;
            total_compressed += r.compressed_size;
            success_count += 1;
        } else {
            let filename = r.file.file_name().unwrap_or_default().to_string_lossy();
            println!(
                "{:<45} {:>50}",
                filename,
                format!("ERROR: {}", r.error.as_deref().unwrap_or("Unknown"))
            );
        }
    }

    println!("{:-<100}", "");
    let total_ratio = if total_original > 0 {
        (total_compressed as f64 / total_original as f64) * 100.0
    } else {
        0.0
    };
    println!(
        "{:<45} {:>15} {:>15} {:>9.1}%",
        format!("Total ({} files)", success_count),
        format_size(total_original),
        format_size(total_compressed),
        total_ratio
    );
}

fn main() -> Result<()> {
    let args = Args::parse();

    rayon::ThreadPoolBuilder::new()
        .num_threads(args.j)
        .build_global()?;

    let config = if let Some(config_path) = &args.config {
        CompressorConfig::from_file_or_default(config_path)
    } else {
        CompressorConfig::default()
    };

    let registry = CompressorRegistry::new();

    if !registry.list_formats().contains(&args.format) {
        println!(
            "Error: Format '{}' not supported. Available formats: {}",
            args.format,
            registry.list_formats().join(", ")
        );
        std::process::exit(1);
    }

    let mut all_files = Vec::new();
    for file_path in &args.files {
        if args.recursive && file_path.is_dir() {
            let recursive_files = collect_files_recursive(file_path)?;
            all_files.extend(recursive_files);
        } else {
            all_files.push(file_path.clone());
        }
    }

    println!(
        "Compressing {} files with {} threads (format: {})...",
        all_files.len(),
        args.j,
        args.format
    );
    let start_time = Instant::now();

    let results: Vec<CompressionResult> = all_files
        .par_iter()
        .map(|file| compress_with_format(file, &args.format, &config, &registry))
        .collect();

    let elapsed = start_time.elapsed();

    let success_count = results.iter().filter(|r| r.success).count();
    let failed_count = results.len() - success_count;

    println!(
        "\nCompleted in {:.2?}: {} succeeded, {} failed",
        elapsed, success_count, failed_count
    );

    if args.diff {
        print_diff_results(&results);
    }

    Ok(())
}
