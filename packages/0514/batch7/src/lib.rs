use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionResult {
    pub file: PathBuf,
    pub original_size: u64,
    pub compressed_size: u64,
    pub format: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatConfig {
    pub quality: u8,
    pub output_extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressorConfig {
    pub formats: HashMap<String, FormatConfig>,
}

impl Default for CompressorConfig {
    fn default() -> Self {
        let mut formats = HashMap::new();
        formats.insert(
            "webp".to_string(),
            FormatConfig {
                quality: 80,
                output_extension: "webp".to_string(),
            },
        );
        formats.insert(
            "avif".to_string(),
            FormatConfig {
                quality: 60,
                output_extension: "avif".to_string(),
            },
        );
        formats.insert(
            "gzip".to_string(),
            FormatConfig {
                quality: 6,
                output_extension: "gz".to_string(),
            },
        );
        Self { formats }
    }
}

impl CompressorConfig {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path)?;
        let config: Self = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn from_file_or_default<P: AsRef<Path>>(path: P) -> Self {
        match Self::from_file(path) {
            Ok(config) => config,
            Err(_) => Self::default(),
        }
    }

    pub fn get_format_config(&self, format: &str) -> Option<&FormatConfig> {
        self.formats.get(format)
    }
}

pub trait ImageCompressor: Send + Sync {
    fn name(&self) -> &str;

    fn compress(&self, input: &Path, output: &Path, quality: u8) -> Result<()>;

    fn supported_extensions(&self) -> Vec<&str>;

    fn default_quality(&self) -> u8 {
        75
    }

    fn default_extension(&self) -> &str {
        self.name()
    }

    fn supports_extension(&self, ext: &str) -> bool {
        self.supported_extensions()
            .iter()
            .any(|&e| e.eq_ignore_ascii_case(ext))
    }
}

pub struct WebPCompressor;

impl ImageCompressor for WebPCompressor {
    fn name(&self) -> &str {
        "webp"
    }

    fn compress(&self, input: &Path, output: &Path, _quality: u8) -> Result<()> {
        let img = image::open(input)?;
        let mut output_file = File::create(output)?;

        let webp_encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut output_file);
        img.write_with_encoder(webp_encoder)?;
        Ok(())
    }

    fn supported_extensions(&self) -> Vec<&str> {
        vec!["jpg", "jpeg", "png", "bmp", "tiff", "gif"]
    }

    fn default_quality(&self) -> u8 {
        80
    }
}

pub struct AVIFCompressor;

impl ImageCompressor for AVIFCompressor {
    fn name(&self) -> &str {
        "avif"
    }

    fn compress(&self, input: &Path, output: &Path, quality: u8) -> Result<()> {
        let img = image::open(input)?;
        let mut output_file = File::create(output)?;

        let quality = quality.clamp(1, 100);

        let avif_encoder = image::codecs::avif::AvifEncoder::new_with_speed_quality(
            &mut output_file,
            4,
            quality,
        );

        img.write_with_encoder(avif_encoder)?;
        Ok(())
    }

    fn supported_extensions(&self) -> Vec<&str> {
        vec!["jpg", "jpeg", "png", "bmp", "tiff", "webp", "gif"]
    }

    fn default_quality(&self) -> u8 {
        60
    }
}

pub struct GzipCompressor;

impl ImageCompressor for GzipCompressor {
    fn name(&self) -> &str {
        "gzip"
    }

    fn compress(&self, input: &Path, output: &Path, quality: u8) -> Result<()> {
        use flate2::write::GzEncoder;
        use flate2::Compression;

        let mut input_file = File::open(input)?;
        let mut buffer = Vec::new();
        input_file.read_to_end(&mut buffer)?;

        let output_file = File::create(output)?;
        let quality = quality.clamp(1, 9);
        let mut encoder = GzEncoder::new(output_file, Compression::new(quality as u32));
        encoder.write_all(&buffer)?;
        encoder.finish()?;
        Ok(())
    }

    fn supported_extensions(&self) -> Vec<&str> {
        vec![
            "txt", "log", "json", "xml", "csv", "html", "css", "js", "md", "toml", "yaml", "yml",
        ]
    }

    fn default_quality(&self) -> u8 {
        6
    }

    fn default_extension(&self) -> &str {
        "gz"
    }
}

pub struct CompressorRegistry {
    compressors: HashMap<String, Box<dyn ImageCompressor>>,
}

impl CompressorRegistry {
    pub fn new() -> Self {
        Self {
            compressors: HashMap::new(),
        }
    }

    pub fn with_default_compressors() -> Self {
        let mut registry = Self::new();
        registry.register(Box::new(WebPCompressor));
        registry.register(Box::new(AVIFCompressor));
        registry.register(Box::new(GzipCompressor));
        registry
    }

    pub fn register(&mut self, compressor: Box<dyn ImageCompressor>) {
        let name = compressor.name().to_string();
        self.compressors.insert(name, compressor);
    }

    pub fn register_all(&mut self, compressors: Vec<Box<dyn ImageCompressor>>) {
        for compressor in compressors {
            self.register(compressor);
        }
    }

    pub fn get(&self, name: &str) -> Option<&dyn ImageCompressor> {
        self.compressors.get(name).map(|c| c.as_ref())
    }

    pub fn list_formats(&self) -> Vec<String> {
        self.compressors.keys().cloned().collect()
    }

    pub fn has_format(&self, name: &str) -> bool {
        self.compressors.contains_key(name)
    }

    pub fn find_compressor_for_extension(&self, ext: &str) -> Vec<&dyn ImageCompressor> {
        self.compressors
            .values()
            .filter(|c| c.supports_extension(ext))
            .map(|c| c.as_ref())
            .collect()
    }

    pub fn unregister(&mut self, name: &str) -> Option<Box<dyn ImageCompressor>> {
        self.compressors.remove(name)
    }

    pub fn len(&self) -> usize {
        self.compressors.len()
    }

    pub fn is_empty(&self) -> bool {
        self.compressors.is_empty()
    }
}

impl Default for CompressorRegistry {
    fn default() -> Self {
        Self::with_default_compressors()
    }
}

pub fn format_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} B", size)
    }
}

pub fn collect_files_recursive<P: AsRef<Path>>(path: P) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            files.push(entry.path().to_path_buf());
        }
    }

    Ok(files)
}

pub fn is_valid_image(path: &Path) -> bool {
    let extensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "avif", "tiff"];
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    extensions.contains(&ext.as_str())
}

pub fn compress_with_format(
    input: &Path,
    format: &str,
    config: &CompressorConfig,
    registry: &CompressorRegistry,
) -> CompressionResult {
    let mut result = CompressionResult {
        file: input.to_path_buf(),
        original_size: 0,
        compressed_size: 0,
        format: format.to_string(),
        success: false,
        error: None,
    };

    let metadata = match fs::metadata(input) {
        Ok(m) => m,
        Err(e) => {
            result.error = Some(format!("Failed to read metadata: {}", e));
            return result;
        }
    };
    result.original_size = metadata.len();

    let compressor = match registry.get(format) {
        Some(c) => c,
        None => {
            result.error = Some(format!("Format '{}' not supported", format));
            return result;
        }
    };

    let default_config = FormatConfig {
        quality: compressor.default_quality(),
        output_extension: compressor.default_extension().to_string(),
    };

    let format_config = config.get_format_config(format).unwrap_or(&default_config);

    let output_path = input.with_extension(&format_config.output_extension);

    if let Err(e) = compressor.compress(input, &output_path, format_config.quality) {
        result.error = Some(format!("Compression failed: {}", e));
        return result;
    }

    let compressed_metadata = match fs::metadata(&output_path) {
        Ok(m) => m,
        Err(e) => {
            result.error = Some(format!("Failed to get compressed size: {}", e));
            return result;
        }
    };

    result.compressed_size = compressed_metadata.len();
    result.success = true;
    result
}

pub fn compress_file_with_registry(
    path: &Path,
    format: &str,
    quality: u8,
    registry: &CompressorRegistry,
) -> CompressionResult {
    let mut config = CompressorConfig::default();
    if let Some(fmt_config) = config.formats.get_mut(format) {
        fmt_config.quality = quality;
    }
    compress_with_format(path, format, &config, registry)
}

pub fn compress_file(path: &Path, level: u32) -> CompressionResult {
    let registry = CompressorRegistry::default();

    let format = if is_valid_image(path) { "webp" } else { "gzip" };

    compress_file_with_registry(path, format, level as u8, &registry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, write};
    use tempfile::tempdir;

    #[test]
    fn test_compress_invalid_file_returns_error() {
        let result = compress_file(Path::new("nonexistent_file.txt"), 6);
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("Failed to read metadata"));
    }

    #[test]
    fn test_compress_valid_file_smaller() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");

        let mut content = String::new();
        for i in 0..1000 {
            content.push_str(&format!("Hello World {}! ", i));
        }
        write(&file_path, &content).unwrap();

        let result = compress_file(&file_path, 6);
        assert!(result.success);
        assert!(result.error.is_none());
        assert!(result.compressed_size < result.original_size);
        assert!(result.compressed_size > 0);
        assert_eq!(result.original_size, content.len() as u64);
    }

    #[test]
    fn test_invalid_image_format_returns_error() {
        let dir = tempdir().unwrap();
        let fake_image = dir.path().join("fake.png");
        write(&fake_image, "not a real image content").unwrap();

        let config = CompressorConfig::default();
        let registry = CompressorRegistry::default();
        let result = compress_with_format(&fake_image, "webp", &config, &registry);
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("Compression failed"));
    }

    #[test]
    fn test_gzip_text_file_compressed_smaller() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");

        let mut content = String::new();
        for i in 0..2000 {
            content.push_str(&format!("Repeating text pattern {} for compression. ", i % 5));
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
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(1500), "1.46 KB");
        assert_eq!(format_size(2 * 1024 * 1024), "2.00 MB");
        assert_eq!(format_size(3 * 1024 * 1024 * 1024), "3.00 GB");
    }

    #[test]
    fn test_is_valid_image() {
        assert!(is_valid_image(Path::new("photo.jpg")));
        assert!(is_valid_image(Path::new("image.PNG")));
        assert!(is_valid_image(Path::new("pic.webp")));
        assert!(is_valid_image(Path::new("photo.avif")));
        assert!(is_valid_image(Path::new("image.tiff")));
        assert!(!is_valid_image(Path::new("doc.txt")));
        assert!(!is_valid_image(Path::new("data")));
        assert!(!is_valid_image(Path::new("file.exe")));
    }

    #[test]
    fn test_collect_files_recursive() {
        let dir = tempdir().unwrap();
        let subdir = dir.path().join("subdir");
        fs::create_dir(&subdir).unwrap();

        write(dir.path().join("a.txt"), "test").unwrap();
        write(dir.path().join("b.txt"), "test").unwrap();
        write(subdir.join("c.txt"), "test").unwrap();

        let files = collect_files_recursive(dir.path()).unwrap();
        assert_eq!(files.len(), 3);
    }

    #[test]
    fn test_collect_files_recursive_nested_structure() {
        let dir = tempdir().unwrap();
        let level1 = dir.path().join("level1");
        let level2 = level1.join("level2");
        let level3 = level2.join("level3");
        fs::create_dir_all(&level3).unwrap();

        write(dir.path().join("root.txt"), "test").unwrap();
        write(level1.join("a.txt"), "test").unwrap();
        write(level2.join("b.txt"), "test").unwrap();
        write(level3.join("c.txt"), "test").unwrap();
        write(level3.join("d.txt"), "test").unwrap();

        let files = collect_files_recursive(dir.path()).unwrap();
        assert_eq!(files.len(), 5);
    }

    #[test]
    fn test_collect_files_recursive_empty_dir() {
        let dir = tempdir().unwrap();
        let files = collect_files_recursive(dir.path()).unwrap();
        assert_eq!(files.len(), 0);
    }

    #[test]
    fn test_compressor_registry() {
        let registry = CompressorRegistry::default();
        let formats = registry.list_formats();
        assert!(formats.contains(&"webp".to_string()));
        assert!(formats.contains(&"avif".to_string()));
        assert!(formats.contains(&"gzip".to_string()));
    }

    #[test]
    fn test_config_default() {
        let config = CompressorConfig::default();
        assert!(config.formats.contains_key("webp"));
        assert!(config.formats.contains_key("avif"));
        assert!(config.formats.contains_key("gzip"));
    }

    #[test]
    fn test_webp_compressor_trait() {
        let compressor = WebPCompressor;
        assert_eq!(compressor.name(), "webp");
        assert!(compressor.supported_extensions().contains(&"png"));
        assert!(compressor.supported_extensions().contains(&"jpg"));
        assert!(compressor.supported_extensions().contains(&"jpeg"));
        assert_eq!(compressor.default_quality(), 80);
    }

    #[test]
    fn test_avif_compressor_trait() {
        let compressor = AVIFCompressor;
        assert_eq!(compressor.name(), "avif");
        assert!(compressor.supported_extensions().contains(&"webp"));
        assert!(compressor.supported_extensions().contains(&"png"));
        assert_eq!(compressor.default_quality(), 60);
    }

    #[test]
    fn test_gzip_compressor_trait() {
        let compressor = GzipCompressor;
        assert_eq!(compressor.name(), "gzip");
        assert!(compressor.supported_extensions().contains(&"txt"));
        assert!(compressor.supported_extensions().contains(&"json"));
        assert!(compressor.supported_extensions().contains(&"html"));
        assert_eq!(compressor.default_quality(), 6);
        assert_eq!(compressor.default_extension(), "gz");
    }

    #[test]
    fn test_compressor_supports_extension() {
        let compressor = WebPCompressor;
        assert!(compressor.supports_extension("png"));
        assert!(compressor.supports_extension("PNG"));
        assert!(compressor.supports_extension("jpg"));
        assert!(!compressor.supports_extension("txt"));
    }

    #[test]
    fn test_registry_with_default_compressors() {
        let registry = CompressorRegistry::with_default_compressors();
        assert_eq!(registry.len(), 3);
        assert!(registry.has_format("webp"));
        assert!(registry.has_format("avif"));
        assert!(registry.has_format("gzip"));
    }

    #[test]
    fn test_registry_empty() {
        let registry = CompressorRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_registry_register_unregister() {
        let mut registry = CompressorRegistry::new();
        assert_eq!(registry.len(), 0);

        registry.register(Box::new(WebPCompressor));
        assert_eq!(registry.len(), 1);
        assert!(registry.has_format("webp"));

        let removed = registry.unregister("webp");
        assert!(removed.is_some());
        assert_eq!(registry.len(), 0);
        assert!(!registry.has_format("webp"));
    }

    #[test]
    fn test_registry_find_compressor_for_extension() {
        let registry = CompressorRegistry::default();
        let compressors = registry.find_compressor_for_extension("png");
        assert!(!compressors.is_empty());
        assert!(compressors.iter().any(|c| c.name() == "webp"));
        assert!(compressors.iter().any(|c| c.name() == "avif"));
    }

    #[test]
    fn test_config_get_format_config() {
        let config = CompressorConfig::default();
        let webp_config = config.get_format_config("webp");
        assert!(webp_config.is_some());
        assert_eq!(webp_config.unwrap().quality, 80);

        let unknown_config = config.get_format_config("unknown");
        assert!(unknown_config.is_none());
    }
}
