use code_stats::*;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_dir() -> TempDir {
    TempDir::new().expect("创建临时目录失败")
}

fn write_file(dir: &TempDir, relative_path: &str, content: &str) -> PathBuf {
    let full_path = dir.path().join(relative_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).expect("创建父目录失败");
    }
    fs::write(&full_path, content).expect("写入文件失败");
    full_path
}

#[test]
fn test_is_empty_or_comment_empty_line() {
    assert!(is_empty_or_comment("", &["//", "#"]));
    assert!(is_empty_or_comment("   ", &["//", "#"]));
    assert!(is_empty_or_comment("\t", &["//", "#"]));
}

#[test]
fn test_is_empty_or_comment_comment_line() {
    assert!(is_empty_or_comment("// 这是注释", &["//", "#"]));
    assert!(is_empty_or_comment("   // 缩进注释", &["//", "#"]));
    assert!(is_empty_or_comment("# Python 注释", &["//", "#"]));
    assert!(is_empty_or_comment("-- SQL 注释", &["--"]));
}

#[test]
fn test_is_empty_or_comment_code_line() {
    assert!(!is_empty_or_comment("let x = 1;", &["//", "#"]));
    assert!(!is_empty_or_comment("print('hello')", &["//", "#"]));
    assert!(!is_empty_or_comment("   const a = 1", &["//", "#"]));
    assert!(!is_empty_or_comment("x // y  # 行内注释", &["//", "#"]));
}

#[test]
fn test_count_code_lines_rust() {
    let content = r#"
// 这是一个注释
fn main() {
    let x = 1;
    
    // 空行之后的注释
    let y = 2;
    println!("x + y = {}", x + y);
}
"#;
    assert_eq!(count_code_lines(content, &["//"]), 5);
}

#[test]
fn test_count_code_lines_python() {
    let content = r#"
# 这是一个注释
def hello():
    x = 1
    
    # 另一个注释
    y = 2
    return x + y
"#;
    assert_eq!(count_code_lines(content, &["#"]), 4);
}

#[test]
fn test_count_code_lines_javascript() {
    let content = r#"
// 这是注释
const x = 1;
const y = 2;

// 空行
console.log(x + y);
"#;
    assert_eq!(count_code_lines(content, &["//"]), 3);
}

#[test]
fn test_get_language_mapping() {
    assert_eq!(get_language("rs"), Some(("Rust", &["//"] as &[&str])));
    assert_eq!(get_language("py"), Some(("Python", &["#"] as &[&str])));
    assert_eq!(get_language("js"), Some(("JavaScript", &["//"] as &[&str])));
    assert_eq!(get_language("ts"), Some(("TypeScript", &["//"] as &[&str])));
    assert_eq!(get_language("unknown"), None);
}

#[test]
fn test_scan_directory_basic() {
    let temp_dir = create_temp_dir();

    write_file(
        &temp_dir,
        "src/main.rs",
        r#"
// 注释
fn main() {
    let x = 1;
    println!("{}", x);
}
"#,
    );

    write_file(
        &temp_dir,
        "src/utils.py",
        r#"
# 注释
def add(a, b):
    return a + b
"#,
    );

    write_file(
        &temp_dir,
        "app.js",
        r#"
// 注释
const x = 1;
console.log(x);
"#,
    );

    let stats = scan_directory(temp_dir.path(), &[]);

    assert_eq!(stats.get("Rust").map(|s| s.file_count), Some(1));
    assert_eq!(stats.get("Rust").map(|s| s.code_lines), Some(3));

    assert_eq!(stats.get("Python").map(|s| s.file_count), Some(1));
    assert_eq!(stats.get("Python").map(|s| s.code_lines), Some(2));

    assert_eq!(stats.get("JavaScript").map(|s| s.file_count), Some(1));
    assert_eq!(stats.get("JavaScript").map(|s| s.code_lines), Some(2));

    let report = build_report(None, vec![], stats.clone());
    assert_eq!(report.total_files, 3);
    assert_eq!(report.total_code_lines, 7);
}

#[test]
fn test_exclude_directory() {
    let temp_dir = create_temp_dir();

    write_file(
        &temp_dir,
        "src/main.rs",
        r#"
fn main() {
    let x = 1;
}
"#,
    );

    write_file(
        &temp_dir,
        "node_modules/lib.js",
        r#"
const x = 1;
console.log(x);
"#,
    );

    write_file(
        &temp_dir,
        ".git/config",
        "ignore me",
    );

    write_file(
        &temp_dir,
        "target/debug/app",
        "binary",
    );

    let stats_without_exclude = scan_directory(temp_dir.path(), &[]);
    assert!(stats_without_exclude.contains_key("JavaScript"));

    let stats_with_exclude = scan_directory(
        temp_dir.path(),
        &[
            "node_modules".to_string(),
            ".git".to_string(),
            "target".to_string(),
        ],
    );

    assert_eq!(stats_with_exclude.len(), 1);
    assert!(stats_with_exclude.contains_key("Rust"));
    assert!(!stats_with_exclude.contains_key("JavaScript"));
    assert_eq!(stats_with_exclude.get("Rust").unwrap().file_count, 1);
    assert_eq!(stats_with_exclude.get("Rust").unwrap().code_lines, 2);
}

#[test]
fn test_should_exclude() {
    use std::path::Path;

    let exclude = vec!["node_modules".to_string(), ".git".to_string()];

    assert!(should_exclude(
        Path::new("/project/node_modules/lib.js"),
        &exclude
    ));
    assert!(should_exclude(
        Path::new("/project/.git/config"),
        &exclude
    ));
    assert!(should_exclude(
        Path::new("/project/src/node_modules/test.js"),
        &exclude
    ));

    assert!(!should_exclude(Path::new("/project/src/main.rs"), &exclude));
    assert!(!should_exclude(Path::new("/project/app.js"), &exclude));
    assert!(!should_exclude(Path::new("/project/my_git_file.js"), &exclude));
}

#[test]
fn test_multiple_files_same_language() {
    let temp_dir = create_temp_dir();

    write_file(
        &temp_dir,
        "src/main.rs",
        r#"
fn main() {
    let x = 1;
}
"#,
    );

    write_file(
        &temp_dir,
        "src/utils.rs",
        r#"
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn sub(a: i32, b: i32) -> i32 {
    a - b
}
"#,
    );

    write_file(
        &temp_dir,
        "src/helper.rs",
        r#"
pub fn helper() {
    println!("helper");
}
"#,
    );

    let stats = scan_directory(temp_dir.path(), &[]);

    assert_eq!(stats.get("Rust").map(|s| s.file_count), Some(3));
    assert_eq!(stats.get("Rust").map(|s| s.code_lines), Some(7));
}

#[test]
fn test_build_report() {
    use std::collections::HashMap;

    let mut stats = HashMap::new();
    stats.insert(
        "Rust".to_string(),
        LanguageStats {
            file_count: 2,
            code_lines: 50,
        },
    );
    stats.insert(
        "Python".to_string(),
        LanguageStats {
            file_count: 3,
            code_lines: 100,
        },
    );

    let report = build_report(
        Some("/my/project".to_string()),
        vec!["node_modules".to_string()],
        stats,
    );

    assert_eq!(report.directory, Some("/my/project".to_string()));
    assert_eq!(report.excluded, vec!["node_modules".to_string()]);
    assert_eq!(report.total_files, 5);
    assert_eq!(report.total_code_lines, 150);
}

#[test]
fn test_format_table() {
    use std::collections::HashMap;

    let mut stats = HashMap::new();
    stats.insert(
        "Rust".to_string(),
        LanguageStats {
            file_count: 1,
            code_lines: 10,
        },
    );

    let report = build_report(None, vec![], stats);
    let output = format_table(&report);

    assert!(output.contains("Rust"));
    assert!(output.contains("Files"));
    assert!(output.contains("Code Lines"));
    assert!(output.contains("Total"));
}

#[test]
fn test_format_json() {
    use std::collections::HashMap;

    let mut stats = HashMap::new();
    stats.insert(
        "Rust".to_string(),
        LanguageStats {
            file_count: 1,
            code_lines: 10,
        },
    );

    let report = build_report(
        Some("/test".to_string()),
        vec!["node_modules".to_string()],
        stats,
    );
    let output = format_json(&report);

    assert!(output.contains("\"languages\""));
    assert!(output.contains("\"Rust\""));
    assert!(output.contains("\"total_files\": 1"));
    assert!(output.contains("\"total_code_lines\": 10"));
}

#[test]
fn test_compute_diff() {
    use std::collections::HashMap;

    let mut old_stats = HashMap::new();
    old_stats.insert(
        "Rust".to_string(),
        LanguageStats {
            file_count: 2,
            code_lines: 50,
        },
    );
    old_stats.insert(
        "Python".to_string(),
        LanguageStats {
            file_count: 1,
            code_lines: 20,
        },
    );

    let mut new_stats = HashMap::new();
    new_stats.insert(
        "Rust".to_string(),
        LanguageStats {
            file_count: 3,
            code_lines: 80,
        },
    );
    new_stats.insert(
        "JavaScript".to_string(),
        LanguageStats {
            file_count: 1,
            code_lines: 30,
        },
    );

    let old_report = build_report(None, vec![], old_stats);
    let new_report = build_report(None, vec![], new_stats);

    let diff = compute_diff(&old_report, &new_report);

    assert_eq!(diff.total_files_old, 3);
    assert_eq!(diff.total_files_new, 4);
    assert_eq!(diff.total_files_diff, 1);

    assert_eq!(diff.total_code_lines_old, 70);
    assert_eq!(diff.total_code_lines_new, 110);
    assert_eq!(diff.total_code_lines_diff, 40);

    let rust_change = diff
        .changes
        .iter()
        .find(|c| c.language == "Rust")
        .unwrap();
    assert_eq!(rust_change.file_count_old, 2);
    assert_eq!(rust_change.file_count_new, 3);
    assert_eq!(rust_change.file_count_diff, 1);
    assert_eq!(rust_change.code_lines_old, 50);
    assert_eq!(rust_change.code_lines_new, 80);
    assert_eq!(rust_change.code_lines_diff, 30);

    let py_change = diff
        .changes
        .iter()
        .find(|c| c.language == "Python")
        .unwrap();
    assert_eq!(py_change.file_count_old, 1);
    assert_eq!(py_change.file_count_new, 0);
    assert_eq!(py_change.file_count_diff, -1);
    assert_eq!(py_change.code_lines_old, 20);
    assert_eq!(py_change.code_lines_new, 0);
    assert_eq!(py_change.code_lines_diff, -20);

    let js_change = diff
        .changes
        .iter()
        .find(|c| c.language == "JavaScript")
        .unwrap();
    assert_eq!(js_change.file_count_old, 0);
    assert_eq!(js_change.file_count_new, 1);
    assert_eq!(js_change.file_count_diff, 1);
    assert_eq!(js_change.code_lines_old, 0);
    assert_eq!(js_change.code_lines_new, 30);
    assert_eq!(js_change.code_lines_diff, 30);
}

#[test]
fn test_process_file() {
    let temp_dir = create_temp_dir();
    let file_path = write_file(
        &temp_dir,
        "test.rs",
        r#"
// 注释
fn main() {
    let x = 1;
    println!("{}", x);
}
"#,
    );

    let mut stats = std::collections::HashMap::new();
    process_file(&file_path, &mut stats);

    assert_eq!(stats.len(), 1);
    assert!(stats.contains_key("Rust"));
    assert_eq!(stats.get("Rust").unwrap().file_count, 1);
    assert_eq!(stats.get("Rust").unwrap().code_lines, 3);
}

#[test]
fn test_unknown_extension_ignored() {
    let temp_dir = create_temp_dir();
    write_file(&temp_dir, "file.unknown", "content");
    write_file(&temp_dir, "no_extension", "content");

    let stats = scan_directory(temp_dir.path(), &[]);
    assert!(stats.is_empty());
}
