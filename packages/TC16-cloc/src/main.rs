use clap::{Parser, ValueEnum};
use code_stats::*;
use std::path::Path;

#[derive(ValueEnum, Clone, Debug)]
enum OutputFormat {
    Table,
    Json,
    Markdown,
}

#[derive(Parser, Debug)]
#[command(name = "code_stats", about = "统计代码行数和文件数量", version = "0.2.0")]
struct Args {
    #[arg(help = "要遍历的目录路径")]
    dir: Option<String>,

    #[arg(short = 'e', long = "exclude", help = "要排除的文件夹名（可多次指定）")]
    exclude: Vec<String>,

    #[arg(long, value_enum, default_value_t = OutputFormat::Table, help = "输出格式")]
    format: OutputFormat,

    #[arg(short = 'o', long = "output", help = "导出结果到指定文件路径")]
    output: Option<String>,

    #[arg(long, value_names = ["OLD_FILE", "NEW_FILE"], help = "比较两次扫描结果的差异")]
    diff: Option<Vec<String>>,
}

fn format_output(report: &Report, format: &OutputFormat) -> String {
    match format {
        OutputFormat::Table => format_table(report),
        OutputFormat::Json => format_json(report),
        OutputFormat::Markdown => format_markdown(report),
    }
}

fn format_diff_output(diff: &DiffReport, format: &OutputFormat) -> String {
    match format {
        OutputFormat::Table => format_diff_table(diff),
        OutputFormat::Json => format_diff_json(diff),
        OutputFormat::Markdown => format_diff_markdown(diff),
    }
}

fn save_output(content: &str, output_path: Option<&str>) {
    if let Some(path) = output_path {
        if let Err(e) = std::fs::write(path, content) {
            eprintln!("警告: 写入文件失败 {}: {}", path, e);
        }
    }
    print!("{}", content);
}

fn main() {
    let args = Args::parse();

    if let Some(diff_files) = args.diff {
        if diff_files.len() != 2 {
            eprintln!("错误: --diff 模式需要指定两个文件路径");
            std::process::exit(1);
        }

        let old_report = match load_report(&diff_files[0]) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("错误: {}", e);
                std::process::exit(1);
            }
        };

        let new_report = match load_report(&diff_files[1]) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("错误: {}", e);
                std::process::exit(1);
            }
        };

        let diff = compute_diff(&old_report, &new_report);
        let output = format_diff_output(&diff, &args.format);
        save_output(&output, args.output.as_deref());
        return;
    }

    let dir = match args.dir {
        Some(d) => d,
        None => {
            eprintln!("错误: 请指定目录路径");
            std::process::exit(1);
        }
    };

    let target_dir = Path::new(&dir);
    if !target_dir.exists() {
        eprintln!("错误: 目录不存在: {}", dir);
        std::process::exit(1);
    }
    if !target_dir.is_dir() {
        eprintln!("错误: 路径不是目录: {}", dir);
        std::process::exit(1);
    }

    let stats = scan_directory(target_dir, &args.exclude);

    if stats.is_empty() {
        println!("未找到可识别的代码文件。");
        return;
    }

    let report = build_report(Some(dir), args.exclude.clone(), stats);
    let output = format_output(&report, &args.format);
    save_output(&output, args.output.as_deref());
}
