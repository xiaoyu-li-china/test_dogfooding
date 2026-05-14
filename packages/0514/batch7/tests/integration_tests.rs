use imgc::{
    collect_files_recursive, compress_file_with_registry, compress_with_format,
    is_valid_image, CompressionResult, CompressorConfig, CompressorRegistry, ImageCompressor,
};
use std::fs::{self, write};
use std::path::Path;
use tempfile::tempdir;

#[test]
fn test_invalid_image_format_returns_error() {
    let dir = tempdir().unwrap();
    let invalid_image = dir.path().join("invalid.png");
    write(&invalid_image, "This is not valid image data").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&invalid_image, "webp", &config, &registry);

    assert!(!result.success);
    assert!(result.error.is_some());
    assert!(result.error.unwrap().contains("Compression failed"));
    assert_eq!(result.format, "webp");
}

#[test]
fn test_corrupted_image_avif_returns_error() {
    let dir = tempdir().unwrap();
    let corrupted_image = dir.path().join("corrupted.jpg");
    write(&corrupted_image, "corrupted binary data here").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&corrupted_image, "avif", &config, &registry);

    assert!(!result.success);
    assert!(result.error.is_some());
}

#[test]
fn test_gzip_text_file_compressed_smaller() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.txt");

    let mut content = String::new();
    for i in 0..5000 {
        content.push_str(&format!("Repeating pattern {} for better compression. ", i % 10));
    }
    write(&file_path, &content).unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&file_path, "gzip", &config, &registry);

    assert!(result.success);
    assert!(result.error.is_none());
    assert!(result.compressed_size < result.original_size);
    assert!(result.compressed_size > 0);
    assert_eq!(result.format, "gzip");
    assert_eq!(result.original_size, content.len() as u64);
}

#[test]
fn test_gzip_json_file_compressed_smaller() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("data.json");

    let json_content = r#"{
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com"}
        ],
        "metadata": {
            "version": "1.0",
            "timestamp": "2024-01-01T00:00:00Z"
        }
    }"#
    .repeat(100);

    write(&file_path, &json_content).unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&file_path, "gzip", &config, &registry);

    assert!(result.success);
    assert!(result.compressed_size < result.original_size);
    assert!(result.compressed_size > 0);
}

#[test]
fn test_recursive_traversal_basic() {
    let dir = tempdir().unwrap();

    let subdir1 = dir.path().join("images");
    let subdir2 = dir.path().join("docs");
    let subsubdir = subdir1.join("photos");
    fs::create_dir_all(&subsubdir).unwrap();
    fs::create_dir(&subdir2).unwrap();

    write(subdir1.join("a.jpg"), "jpg data").unwrap();
    write(subdir1.join("b.png"), "png data").unwrap();
    write(subsubdir.join("c.webp"), "webp data").unwrap();
    write(subdir2.join("d.txt"), "text data").unwrap();
    write(dir.path().join("e.gif"), "gif data").unwrap();

    let files = collect_files_recursive(dir.path()).unwrap();
    assert_eq!(files.len(), 5);

    let image_count = files.iter().filter(|f| is_valid_image(f)).count();
    assert_eq!(image_count, 4);
}

#[test]
fn test_recursive_traversal_nested_deep() {
    let dir = tempdir().unwrap();
    let mut current = dir.path().to_path_buf();

    for level in 0..5 {
        current = current.join(format!("level{}", level));
        fs::create_dir(&current).unwrap();
        write(current.join(format!("file{}.txt", level)), "test").unwrap();
    }

    let files = collect_files_recursive(dir.path()).unwrap();
    assert_eq!(files.len(), 5);
}

#[test]
fn test_recursive_traversal_mixed_types() {
    let dir = tempdir().unwrap();

    let images = dir.path().join("images");
    let documents = dir.path().join("documents");
    let archives = dir.path().join("archives");
    fs::create_dir_all(&images).unwrap();
    fs::create_dir_all(&documents).unwrap();
    fs::create_dir_all(&archives).unwrap();

    write(images.join("photo1.jpg"), "fake jpg").unwrap();
    write(images.join("photo2.png"), "fake png").unwrap();
    write(images.join("photo3.webp"), "fake webp").unwrap();
    write(documents.join("readme.txt"), "text").unwrap();
    write(documents.join("config.json"), "{}").unwrap();
    write(archives.join("data.csv"), "csv").unwrap();
    write(dir.path().join("root.txt"), "root file").unwrap();

    let files = collect_files_recursive(dir.path()).unwrap();
    assert_eq!(files.len(), 7);

    let image_files: Vec<_> = files.iter().filter(|f| is_valid_image(f)).collect();
    assert_eq!(image_files.len(), 3);
}

#[test]
fn test_recursive_traversal_empty_directory() {
    let dir = tempdir().unwrap();
    let files = collect_files_recursive(dir.path()).unwrap();
    assert!(files.is_empty());
}

#[test]
fn test_recursive_traversal_single_file() {
    let dir = tempdir().unwrap();
    write(dir.path().join("single.txt"), "test").unwrap();
    let files = collect_files_recursive(dir.path()).unwrap();
    assert_eq!(files.len(), 1);
}

#[test]
fn test_compression_level_produces_valid_results() {
    let dir = tempdir().unwrap();
    let file1 = dir.path().join("test1.txt");

    let mut content = String::new();
    for i in 0..5000 {
        content.push_str(&format!("Data {} with repeating pattern. ", i % 10));
    }
    write(&file1, &content).unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&file1, "gzip", &config, &registry);

    assert!(result.success);
    assert!(result.compressed_size > 0);
    assert!(result.compressed_size < result.original_size);
}

#[test]
fn test_multiple_files_parallel_compression() {
    use rayon::prelude::*;

    let dir = tempdir().unwrap();

    for i in 0..10 {
        let file_path = dir.path().join(format!("file{}.txt", i));
        let mut content = String::new();
        for j in 0..500 {
            content.push_str(&format!("Content {} {} with repetition. ", i, j % 5));
        }
        write(&file_path, &content).unwrap();
    }

    let files = collect_files_recursive(dir.path()).unwrap();
    assert_eq!(files.len(), 10);

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let results: Vec<CompressionResult> = files
        .par_iter()
        .map(|f| compress_with_format(f, "gzip", &config, &registry))
        .collect();

    assert_eq!(results.len(), 10);
    for result in results {
        assert!(result.success);
        assert!(result.compressed_size < result.original_size);
        assert!(result.compressed_size > 0);
        assert_eq!(result.format, "gzip");
    }
}

#[test]
fn test_empty_file_compression() {
    let dir = tempdir().unwrap();
    let empty_file = dir.path().join("empty.txt");
    write(&empty_file, "").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&empty_file, "gzip", &config, &registry);
    assert!(result.success);
    assert_eq!(result.original_size, 0);
    assert!(result.compressed_size > 0);
}

#[test]
fn test_nonexistent_file_error() {
    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(
        Path::new("/nonexistent/path/file_should_not_exist.txt"),
        "gzip",
        &config,
        &registry,
    );
    assert!(!result.success);
    assert!(result.error.is_some());
    assert!(result.error.unwrap().contains("Failed to read metadata"));
}

#[test]
fn test_config_from_file() {
    let dir = tempdir().unwrap();
    let config_path = dir.path().join("test_config.toml");

    let config_content = r#"
[formats.webp]
quality = 90
output_extension = "webp"

[formats.avif]
quality = 70
output_extension = "avif"

[formats.gzip]
quality = 9
output_extension = "gz"
"#;
    write(&config_path, config_content).unwrap();

    let config = CompressorConfig::from_file(&config_path).unwrap();
    assert_eq!(config.formats.get("webp").unwrap().quality, 90);
    assert_eq!(config.formats.get("avif").unwrap().quality, 70);
    assert_eq!(config.formats.get("gzip").unwrap().quality, 9);
}

#[test]
fn test_unsupported_format_error() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.txt");
    write(&file_path, "test content").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();
    let result = compress_with_format(&file_path, "unsupported_format_xyz", &config, &registry);
    assert!(!result.success);
    assert!(result.error.is_some());
    assert!(result.error.unwrap().contains("not supported"));
}

#[test]
fn test_format_field_in_result() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.txt");
    write(&file_path, "test content for compression testing").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();

    let result_gzip = compress_with_format(&file_path, "gzip", &config, &registry);
    assert!(result_gzip.success);
    assert_eq!(result_gzip.format, "gzip");
}

#[test]
fn test_compressor_registry_list_formats() {
    let registry = CompressorRegistry::default();
    let formats = registry.list_formats();
    assert!(formats.contains(&"webp".to_string()));
    assert!(formats.contains(&"avif".to_string()));
    assert!(formats.contains(&"gzip".to_string()));
    assert_eq!(formats.len(), 3);
}

#[test]
fn test_compressor_registry_get_compressor() {
    let registry = CompressorRegistry::default();

    let webp = registry.get("webp");
    assert!(webp.is_some());
    assert_eq!(webp.unwrap().name(), "webp");

    let avif = registry.get("avif");
    assert!(avif.is_some());
    assert_eq!(avif.unwrap().name(), "avif");

    let gzip = registry.get("gzip");
    assert!(gzip.is_some());
    assert_eq!(gzip.unwrap().name(), "gzip");

    let unknown = registry.get("unknown");
    assert!(unknown.is_none());
}

#[test]
fn test_mixed_files_some_invalid_images() {
    let dir = tempdir().unwrap();

    let file1 = dir.path().join("valid.txt");
    let file2 = dir.path().join("fake_image.png");

    write(&file1, "This is a valid text file for gzip compression".repeat(100)).unwrap();
    write(&file2, "This is not actually a PNG file").unwrap();

    let config = CompressorConfig::default();
    let registry = CompressorRegistry::default();

    let result1 = compress_with_format(&file1, "gzip", &config, &registry);
    assert!(result1.success);

    let result2 = compress_with_format(&file2, "webp", &config, &registry);
    assert!(!result2.success);
}

#[test]
fn test_plugin_registry_dynamic_register() {
    let mut registry = CompressorRegistry::new();
    assert_eq!(registry.len(), 0);

    registry.register(Box::new(imgc::WebPCompressor));
    assert_eq!(registry.len(), 1);
    assert!(registry.has_format("webp"));

    registry.register(Box::new(imgc::AVIFCompressor));
    assert_eq!(registry.len(), 2);
    assert!(registry.has_format("avif"));
}

#[test]
fn test_plugin_registry_register_all() {
    let mut registry = CompressorRegistry::new();
    assert_eq!(registry.len(), 0);

    let compressors: Vec<Box<dyn ImageCompressor>> = vec![
        Box::new(imgc::WebPCompressor),
        Box::new(imgc::AVIFCompressor),
        Box::new(imgc::GzipCompressor),
    ];

    registry.register_all(compressors);
    assert_eq!(registry.len(), 3);
    assert!(registry.has_format("webp"));
    assert!(registry.has_format("avif"));
    assert!(registry.has_format("gzip"));
}

#[test]
fn test_plugin_registry_unregister() {
    let mut registry = CompressorRegistry::default();
    assert_eq!(registry.len(), 3);

    let removed = registry.unregister("webp");
    assert!(removed.is_some());
    assert_eq!(registry.len(), 2);
    assert!(!registry.has_format("webp"));

    let removed_unknown = registry.unregister("unknown");
    assert!(removed_unknown.is_none());
    assert_eq!(registry.len(), 2);
}

#[test]
fn test_compressor_file_with_registry() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.txt");

    let mut content = String::new();
    for i in 0..1000 {
        content.push_str(&format!("Test content {} for compression. ", i));
    }
    write(&file_path, &content).unwrap();

    let registry = CompressorRegistry::default();
    let result = compress_file_with_registry(&file_path, "gzip", 9, &registry);

    assert!(result.success);
    assert!(result.compressed_size < result.original_size);
    assert_eq!(result.format, "gzip");
}

#[test]
fn test_custom_compressor_plugin() {
    struct MockCompressor;

    impl ImageCompressor for MockCompressor {
        fn name(&self) -> &str {
            "mock"
        }

        fn compress(&self, input: &Path, output: &Path, _quality: u8) -> anyhow::Result<()> {
            let content = fs::read(input)?;
            fs::write(output, &content[..content.len() / 2])?;
            Ok(())
        }

        fn supported_extensions(&self) -> Vec<&str> {
            vec!["txt", "dat"]
        }

        fn default_quality(&self) -> u8 {
            50
        }

        fn default_extension(&self) -> &str {
            "mock"
        }
    }

    let mut registry = CompressorRegistry::new();
    registry.register(Box::new(MockCompressor));

    assert!(registry.has_format("mock"));
    assert_eq!(registry.len(), 1);

    let compressor = registry.get("mock");
    assert!(compressor.is_some());
    assert_eq!(compressor.unwrap().name(), "mock");
    assert_eq!(compressor.unwrap().default_quality(), 50);
    assert_eq!(compressor.unwrap().default_extension(), "mock");
}

#[test]
fn test_compress_without_config_uses_plugin_defaults() {
    let mut registry = CompressorRegistry::new();
    registry.register(Box::new(imgc::GzipCompressor));

    let config = CompressorConfig {
        formats: std::collections::HashMap::new(),
    };

    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.txt");
    write(&file_path, "Test content that will be compressed".repeat(100)).unwrap();

    let result = compress_with_format(&file_path, "gzip", &config, &registry);
    assert!(result.success);
    assert!(result.compressed_size < result.original_size);
}

#[test]
fn test_find_compressor_for_file_extension() {
    let registry = CompressorRegistry::default();

    let png_compressors = registry.find_compressor_for_extension("png");
    assert!(png_compressors.len() >= 2);
    assert!(png_compressors.iter().any(|c| c.name() == "webp"));
    assert!(png_compressors.iter().any(|c| c.name() == "avif"));

    let txt_compressors = registry.find_compressor_for_extension("txt");
    assert_eq!(txt_compressors.len(), 1);
    assert_eq!(txt_compressors[0].name(), "gzip");
}

#[test]
fn test_compressor_supports_extension_case_insensitive() {
    let compressor = imgc::WebPCompressor;
    assert!(compressor.supports_extension("png"));
    assert!(compressor.supports_extension("PNG"));
    assert!(compressor.supports_extension("Png"));
    assert!(!compressor.supports_extension("TXT"));
}
