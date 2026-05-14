use anyhow::{Context, Result};
use clap::Parser;
use image::ImageFormat;
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use walkdir::WalkDir;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Args {
    #[arg(short, long, default_value = "85")]
    pub quality: u8,

    #[arg(short, long)]
    pub output: PathBuf,

    #[arg(short, long, default_value = "false")]
    pub recursive: bool,

    #[arg(short, long, default_value = "4")]
    pub threads: usize,

    #[arg(long, default_value = "false")]
    pub diff: bool,

    pub input: PathBuf,
}

#[derive(Debug, Clone)]
pub struct CompressionResult {
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub original_size: u64,
    pub compressed_size: u64,
}

impl CompressionResult {
    pub fn savings(&self) -> i64 {
        self.original_size as i64 - self.compressed_size as i64
    }

    pub fn savings_ratio(&self) -> f64 {
        if self.original_size == 0 {
            0.0
        } else {
            self.savings() as f64 / self.original_size as f64
        }
    }
}

fn main() -> Result<()> {
    let args = Args::parse();

    let quality = args.quality.clamp(1, 100);

    let thread_pool = rayon::ThreadPoolBuilder::new()
        .num_threads(args.threads)
        .build()?;

    std::fs::create_dir_all(&args.output)
        .with_context(|| format!("Failed to create output directory: {:?}", args.output))?;

    let results = if args.input.is_file() {
        vec![process_image(&args.input, &args.output, quality)?]
    } else if args.input.is_dir() {
        thread_pool.install(|| process_directory(&args.input, &args.output, quality, args.recursive))?
    } else {
        anyhow::bail!("Input path is neither a file nor a directory: {:?}", args.input);
    };

    if args.diff {
        print_diff_summary(&results);
    }

    println!("Done! Processed {} images", results.len());
    Ok(())
}

pub fn process_directory(
    input_dir: &Path,
    output_dir: &Path,
    quality: u8,
    recursive: bool,
) -> Result<Vec<CompressionResult>> {
    let walker = if recursive {
        WalkDir::new(input_dir)
    } else {
        WalkDir::new(input_dir).max_depth(1)
    };

    let image_paths: Vec<(PathBuf, PathBuf)> = walker
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("jpg")
                    || ext.eq_ignore_ascii_case("jpeg")
                    || ext.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
        })
        .filter_map(|entry| {
            let path = entry.path().to_path_buf();
            let rel_path = path.strip_prefix(input_dir).ok()?;
            let parent = rel_path.parent()?;
            let output_subdir = output_dir.join(parent);
            Some((path, output_subdir))
        })
        .collect();

    let results: Vec<Result<CompressionResult>> = image_paths
        .par_iter()
        .map(|(input_path, output_subdir)| {
            std::fs::create_dir_all(output_subdir)?;
            process_image(input_path, output_subdir, quality)
        })
        .collect();

    let mut successful = Vec::new();
    for result in results {
        match result {
            Ok(r) => successful.push(r),
            Err(e) => eprintln!("Warning: {}", e),
        }
    }

    Ok(successful)
}

pub fn process_image(
    input_path: &Path,
    output_dir: &Path,
    quality: u8,
) -> Result<CompressionResult> {
    let format = match input_path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("png") => ImageFormat::Png,
        Some(ext) if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") => {
            ImageFormat::Jpeg
        }
        _ => {
            anyhow::bail!("Unsupported file format: {:?}", input_path);
        }
    };

    let original_size = std::fs::metadata(input_path)
        .with_context(|| format!("Failed to read file metadata: {:?}", input_path))?
        .len();

    let img = image::open(input_path)
        .with_context(|| format!("Failed to open image: {:?}", input_path))?;

    let file_name = input_path
        .file_name()
        .with_context(|| format!("Invalid file name: {:?}", input_path))?;

    let output_path = output_dir.join(file_name);

    match format {
        ImageFormat::Jpeg => {
            let mut output = std::fs::File::create(&output_path)?;
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, quality);
            img.write_with_encoder(encoder)
                .with_context(|| format!("Failed to encode JPEG: {:?}", output_path))?;
        }
        ImageFormat::Png => {
            let mut output = std::fs::File::create(&output_path)?;
            let encoder = image::codecs::png::PngEncoder::new_with_quality(
                &mut output,
                image::codecs::png::CompressionType::Best,
                image::codecs::png::FilterType::Adaptive,
            );
            img.write_with_encoder(encoder)
                .with_context(|| format!("Failed to encode PNG: {:?}", output_path))?;
        }
        _ => unreachable!(),
    }

    let compressed_size = std::fs::metadata(&output_path)
        .with_context(|| format!("Failed to read output file metadata: {:?}", output_path))?
        .len();

    Ok(CompressionResult {
        input_path: input_path.to_path_buf(),
        output_path,
        original_size,
        compressed_size,
    })
}

pub fn print_diff_summary(results: &[CompressionResult]) {
    let total_original: u64 = results.iter().map(|r| r.original_size).sum();
    let total_compressed: u64 = results.iter().map(|r| r.compressed_size).sum();
    let total_savings = total_original as i64 - total_compressed as i64;
    let savings_ratio = if total_original > 0 {
        total_savings as f64 / total_original as f64
    } else {
        0.0
    };

    println!("\n=== Compression Summary ===");
    println!("{:<40} {:>12} {:>12} {:>12} {:>8}", 
        "File", "Original", "Compressed", "Savings", "Ratio");
    println!("{}", "-".repeat(90));

    for result in results {
        let file_name = result.input_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        let display_name = if file_name.len() > 35 {
            format!("...{}", &file_name[file_name.len() - 32..])
        } else {
            file_name.to_string()
        };

        println!("{:<40} {:>10}KB {:>10}KB {:>+10}KB {:>7.1}%",
            display_name,
            result.original_size / 1024,
            result.compressed_size / 1024,
            result.savings() / 1024,
            result.savings_ratio() * 100.0);
    }

    println!("{}", "-".repeat(90));
    println!("{:<40} {:>10}KB {:>10}KB {:>+10}KB {:>7.1}%",
        "TOTAL",
        total_original / 1024,
        total_compressed / 1024,
        total_savings / 1024,
        savings_ratio * 100.0);
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};
    use std::fs::File;
    use tempfile::tempdir;

    fn create_test_jpeg(path: &Path, width: u32, height: u32) -> Result<()> {
        let mut img = RgbImage::new(width, height);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = Rgb([x as u8, y as u8, (x + y) as u8]);
        }
        let mut file = File::create(path)?;
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut file, 100);
        img.write_with_encoder(encoder)?;
        Ok(())
    }

    fn create_test_png(path: &Path, width: u32, height: u32) -> Result<()> {
        let mut img = RgbImage::new(width, height);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = Rgb([x as u8, y as u8, (x + y) as u8]);
        }
        img.save_with_format(path, ImageFormat::Png)?;
        Ok(())
    }

    #[test]
    fn test_invalid_image_returns_error() {
        let temp_dir = tempdir().unwrap();
        let invalid_file = temp_dir.path().join("invalid.jpg");
        std::fs::write(&invalid_file, b"not an image").unwrap();

        let result = process_image(&invalid_file, temp_dir.path(), 85);
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_jpeg_output_smaller_than_original() -> Result<()> {
        let temp_dir = tempdir()?;
        let input_path = temp_dir.path().join("test.jpg");
        create_test_jpeg(&input_path, 800, 600)?;

        let original_size = std::fs::metadata(&input_path)?.len();
        let result = process_image(&input_path, temp_dir.path(), 50)?;

        assert!(result.compressed_size < original_size, 
            "Compressed size {} should be less than original size {}", 
            result.compressed_size, original_size);
        assert!(result.output_path.exists());
        Ok(())
    }

    #[test]
    fn test_valid_png_output_smaller_than_original() -> Result<()> {
        let temp_dir = tempdir()?;
        let input_path = temp_dir.path().join("test.png");
        create_test_png(&input_path, 800, 600)?;

        let result = process_image(&input_path, temp_dir.path(), 85)?;
        assert!(result.output_path.exists());
        Ok(())
    }

    #[test]
    fn test_recursive_traversal() -> Result<()> {
        let temp_dir = tempdir()?;
        let input_dir = temp_dir.path().join("input");
        let output_dir = temp_dir.path().join("output");
        std::fs::create_dir_all(&input_dir)?;

        create_test_jpeg(&input_dir.join("img1.jpg"), 200, 200)?;
        
        let subdir = input_dir.join("subdir");
        std::fs::create_dir_all(&subdir)?;
        create_test_jpeg(&subdir.join("img2.jpg"), 200, 200)?;

        let results = process_directory(&input_dir, &output_dir, 85, true)?;
        assert_eq!(results.len(), 2);
        assert!(output_dir.join("img1.jpg").exists());
        assert!(output_dir.join("subdir/img2.jpg").exists());

        Ok(())
    }

    #[test]
    fn test_non_recursive_traversal() -> Result<()> {
        let temp_dir = tempdir()?;
        let input_dir = temp_dir.path().join("input");
        let output_dir = temp_dir.path().join("output");
        std::fs::create_dir_all(&input_dir)?;

        create_test_jpeg(&input_dir.join("img1.jpg"), 200, 200)?;
        
        let subdir = input_dir.join("subdir");
        std::fs::create_dir_all(&subdir)?;
        create_test_jpeg(&subdir.join("img2.jpg"), 200, 200)?;

        let results = process_directory(&input_dir, &output_dir, 85, false)?;
        assert_eq!(results.len(), 1);
        assert!(output_dir.join("img1.jpg").exists());
        assert!(!output_dir.join("subdir/img2.jpg").exists());

        Ok(())
    }

    #[test]
    fn test_compression_result_calculations() {
        let result = CompressionResult {
            input_path: PathBuf::from("test.jpg"),
            output_path: PathBuf::from("out/test.jpg"),
            original_size: 1000,
            compressed_size: 600,
        };

        assert_eq!(result.savings(), 400);
        assert_eq!(result.savings_ratio(), 0.4);
    }
}
