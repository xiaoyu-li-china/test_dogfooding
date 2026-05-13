use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct LanguageStats {
    pub file_count: usize,
    pub code_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub directory: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub excluded: Vec<String>,
    pub languages: HashMap<String, LanguageStats>,
    pub total_files: usize,
    pub total_code_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffItem {
    pub language: String,
    pub file_count_old: usize,
    pub file_count_new: usize,
    pub file_count_diff: isize,
    pub code_lines_old: usize,
    pub code_lines_new: usize,
    pub code_lines_diff: isize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffReport {
    pub total_files_old: usize,
    pub total_files_new: usize,
    pub total_files_diff: isize,
    pub total_code_lines_old: usize,
    pub total_code_lines_new: usize,
    pub total_code_lines_diff: isize,
    pub changes: Vec<DiffItem>,
}

pub fn get_language(extension: &str) -> Option<(&'static str, &'static [&'static str])> {
    let languages: HashMap<&str, (&str, &[&str])> = [
        ("rs", ("Rust", &["//"])),
        ("py", ("Python", &["#"])),
        ("js", ("JavaScript", &["//"])),
        ("ts", ("TypeScript", &["//"])),
        ("tsx", ("TypeScript", &["//"])),
        ("jsx", ("JavaScript", &["//"])),
        ("java", ("Java", &["//"])),
        ("c", ("C", &["//"])),
        ("cpp", ("C++", &["//"])),
        ("cc", ("C++", &["//"])),
        ("h", ("C/C++ Header", &["//"])),
        ("hpp", ("C++ Header", &["//"])),
        ("go", ("Go", &["//"])),
        ("rb", ("Ruby", &["#"])),
        ("php", ("PHP", &["//", "#"])),
        ("swift", ("Swift", &["//"])),
        ("kt", ("Kotlin", &["//"])),
        ("scala", ("Scala", &["//"])),
        ("cs", ("C#", &["//"])),
        ("sh", ("Shell", &["#"])),
        ("bash", ("Bash", &["#"])),
        ("zsh", ("Zsh", &["#"])),
        ("json", ("JSON", &[])),
        ("yaml", ("YAML", &["#"])),
        ("yml", ("YAML", &["#"])),
        ("toml", ("TOML", &["#"])),
        ("ini", ("INI", &["#", ";"])),
        ("sql", ("SQL", &["--"])),
        ("html", ("HTML", &[])),
        ("htm", ("HTML", &[])),
        ("css", ("CSS", &[])),
        ("scss", ("SCSS", &["//"])),
        ("sass", ("Sass", &["//"])),
        ("less", ("Less", &["//"])),
        ("md", ("Markdown", &[])),
        ("txt", ("Text", &[])),
        ("xml", ("XML", &[])),
    ]
    .iter()
    .cloned()
    .collect();

    languages.get(extension).copied()
}

pub fn is_empty_or_comment(line: &str, comment_markers: &[&str]) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return true;
    }
    for marker in comment_markers {
        if trimmed.starts_with(marker) {
            return true;
        }
    }
    false
}

pub fn count_code_lines(content: &str, comment_markers: &[&str]) -> usize {
    content
        .lines()
        .filter(|line| !is_empty_or_comment(line, comment_markers))
        .count()
}

pub fn should_exclude(path: &Path, exclude_dirs: &[String]) -> bool {
    path.components().any(|comp| {
        comp.as_os_str()
            .to_str()
            .map(|s| exclude_dirs.contains(&s.to_string()))
            .unwrap_or(false)
    })
}

pub fn process_file(path: &Path, stats: &mut HashMap<String, LanguageStats>) {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if let Some((lang_name, comment_markers)) = get_language(&extension) {
        if let Ok(content) = fs::read_to_string(path) {
            let code_lines = count_code_lines(&content, comment_markers);
            let stat = stats.entry(lang_name.to_string()).or_default();
            stat.file_count += 1;
            stat.code_lines += code_lines;
        }
    }
}

pub fn scan_directory(target_dir: &Path, exclude: &[String]) -> HashMap<String, LanguageStats> {
    let mut stats: HashMap<String, LanguageStats> = HashMap::new();

    for entry in WalkDir::new(target_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        if should_exclude(path, exclude) {
            continue;
        }

        if path.is_file() {
            process_file(path, &mut stats);
        }
    }

    stats
}

pub fn build_report(
    directory: Option<String>,
    excluded: Vec<String>,
    stats: HashMap<String, LanguageStats>,
) -> Report {
    let total_files = stats.values().map(|s| s.file_count).sum();
    let total_code_lines = stats.values().map(|s| s.code_lines).sum();

    Report {
        directory,
        excluded,
        languages: stats,
        total_files,
        total_code_lines,
    }
}

pub fn sorted_languages(report: &Report) -> Vec<(&String, &LanguageStats)> {
    let mut sorted: Vec<_> = report.languages.iter().collect();
    sorted.sort_by(|a, b| b.1.code_lines.cmp(&a.1.code_lines));
    sorted
}

pub fn format_table(report: &Report) -> String {
    let mut output = String::new();
    output.push_str(&format!(
        "{:<20} {:>12} {:>15}\n",
        "Language", "Files", "Code Lines"
    ));
    output.push_str(&"-".repeat(50));
    output.push('\n');

    for (lang, stat) in sorted_languages(report) {
        output.push_str(&format!(
            "{:<20} {:>12} {:>15}\n",
            lang, stat.file_count, stat.code_lines
        ));
    }

    output.push_str(&"-".repeat(50));
    output.push('\n');
    output.push_str(&format!(
        "{:<20} {:>12} {:>15}\n",
        "Total", report.total_files, report.total_code_lines
    ));

    output
}

pub fn format_json(report: &Report) -> String {
    serde_json::to_string_pretty(report).unwrap_or_else(|_| "{}".to_string())
}

pub fn format_markdown(report: &Report) -> String {
    let mut output = String::new();

    output.push_str("## Code Statistics\n\n");

    if let Some(dir) = &report.directory {
        output.push_str(&format!("**Directory:** `{}`\n\n", dir));
    }

    if !report.excluded.is_empty() {
        output.push_str(&format!(
            "**Excluded:** {}\n\n",
            report
                .excluded
                .iter()
                .map(|x| format!("`{}`", x))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    output.push_str("| Language | Files | Code Lines |\n");
    output.push_str("|----------|-------|------------|\n");

    for (lang, stat) in sorted_languages(report) {
        output.push_str(&format!(
            "| {} | {} | {} |\n",
            lang, stat.file_count, stat.code_lines
        ));
    }

    output.push_str(&format!(
        "| **Total** | **{}** | **{}** |\n",
        report.total_files, report.total_code_lines
    ));

    output
}

pub fn compute_diff(old: &Report, new: &Report) -> DiffReport {
    let mut all_langs: std::collections::HashSet<&String> = std::collections::HashSet::new();
    all_langs.extend(old.languages.keys());
    all_langs.extend(new.languages.keys());

    let mut changes: Vec<DiffItem> = Vec::new();

    for lang in all_langs {
        let old_stat = old.languages.get(lang);
        let new_stat = new.languages.get(lang);

        let file_count_old = old_stat.map(|s| s.file_count).unwrap_or(0);
        let file_count_new = new_stat.map(|s| s.file_count).unwrap_or(0);
        let file_count_diff = file_count_new as isize - file_count_old as isize;

        let code_lines_old = old_stat.map(|s| s.code_lines).unwrap_or(0);
        let code_lines_new = new_stat.map(|s| s.code_lines).unwrap_or(0);
        let code_lines_diff = code_lines_new as isize - code_lines_old as isize;

        changes.push(DiffItem {
            language: lang.clone(),
            file_count_old,
            file_count_new,
            file_count_diff,
            code_lines_old,
            code_lines_new,
            code_lines_diff,
        });
    }

    changes.sort_by(|a, b| b.code_lines_diff.cmp(&a.code_lines_diff));

    DiffReport {
        total_files_old: old.total_files,
        total_files_new: new.total_files,
        total_files_diff: new.total_files as isize - old.total_files as isize,
        total_code_lines_old: old.total_code_lines,
        total_code_lines_new: new.total_code_lines,
        total_code_lines_diff: new.total_code_lines as isize - old.total_code_lines as isize,
        changes,
    }
}

pub fn format_diff_table(diff: &DiffReport) -> String {
    let mut output = String::new();

    output.push_str(&format!(
        "{:<20} {:>10} {:>10} {:>10} {:>10} {:>10} {:>10}\n",
        "Language", "Files Old", "Files New", "Files ±", "Lines Old", "Lines New", "Lines ±"
    ));
    output.push_str(&"-".repeat(80));
    output.push('\n');

    for item in &diff.changes {
        let files_diff_str = if item.file_count_diff >= 0 {
            format!("+{}", item.file_count_diff)
        } else {
            format!("{}", item.file_count_diff)
        };
        let lines_diff_str = if item.code_lines_diff >= 0 {
            format!("+{}", item.code_lines_diff)
        } else {
            format!("{}", item.code_lines_diff)
        };

        output.push_str(&format!(
            "{:<20} {:>10} {:>10} {:>10} {:>10} {:>10} {:>10}\n",
            item.language,
            item.file_count_old,
            item.file_count_new,
            files_diff_str,
            item.code_lines_old,
            item.code_lines_new,
            lines_diff_str
        ));
    }

    output.push_str(&"-".repeat(80));
    output.push('\n');

    let total_files_diff_str = if diff.total_files_diff >= 0 {
        format!("+{}", diff.total_files_diff)
    } else {
        format!("{}", diff.total_files_diff)
    };
    let total_lines_diff_str = if diff.total_code_lines_diff >= 0 {
        format!("+{}", diff.total_code_lines_diff)
    } else {
        format!("{}", diff.total_code_lines_diff)
    };

    output.push_str(&format!(
        "{:<20} {:>10} {:>10} {:>10} {:>10} {:>10} {:>10}\n",
        "Total",
        diff.total_files_old,
        diff.total_files_new,
        total_files_diff_str,
        diff.total_code_lines_old,
        diff.total_code_lines_new,
        total_lines_diff_str
    ));

    output
}

pub fn format_diff_json(diff: &DiffReport) -> String {
    serde_json::to_string_pretty(diff).unwrap_or_else(|_| "{}".to_string())
}

pub fn format_diff_markdown(diff: &DiffReport) -> String {
    let mut output = String::new();

    output.push_str("## Diff Report\n\n");

    output.push_str("| Language | Files Old | Files New | Files ± | Lines Old | Lines New | Lines ± |\n");
    output.push_str("|----------|-----------|-----------|---------|-----------|-----------|---------|\n");

    for item in &diff.changes {
        let files_diff_str = if item.file_count_diff >= 0 {
            format!("+{}", item.file_count_diff)
        } else {
            format!("{}", item.file_count_diff)
        };
        let lines_diff_str = if item.code_lines_diff >= 0 {
            format!("+{}", item.code_lines_diff)
        } else {
            format!("{}", item.code_lines_diff)
        };

        output.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} | {} |\n",
            item.language,
            item.file_count_old,
            item.file_count_new,
            files_diff_str,
            item.code_lines_old,
            item.code_lines_new,
            lines_diff_str
        ));
    }

    let total_files_diff_str = if diff.total_files_diff >= 0 {
        format!("+{}", diff.total_files_diff)
    } else {
        format!("{}", diff.total_files_diff)
    };
    let total_lines_diff_str = if diff.total_code_lines_diff >= 0 {
        format!("+{}", diff.total_code_lines_diff)
    } else {
        format!("{}", diff.total_code_lines_diff)
    };

    output.push_str(&format!(
        "| **Total** | **{}** | **{}** | **{}** | **{}** | **{}** | **{}** |\n",
        diff.total_files_old,
        diff.total_files_new,
        total_files_diff_str,
        diff.total_code_lines_old,
        diff.total_code_lines_new,
        total_lines_diff_str
    ));

    output
}

pub fn load_report(path: &str) -> Result<Report, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("读取文件失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析 JSON 失败: {}", e))
}
