#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path


WINDOWS_ILLEGAL_CHARS = r'\\/:*?"<>|'
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="根据正则表达式重命名文件"
    )
    parser.add_argument(
        "--pattern",
        required=True,
        help="匹配文件名的正则表达式模式"
    )
    parser.add_argument(
        "--replacement",
        required=True,
        help="替换字符串，支持 \\1, \\2 等反向引用"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="预览重命名操作，不实际执行"
    )
    parser.add_argument(
        "--directory",
        default=".",
        help="目标目录，默认为当前目录"
    )
    return parser.parse_args()


def sanitize_filename(filename):
    for char in WINDOWS_ILLEGAL_CHARS:
        filename = filename.replace(char, "_")

    name_part, _, ext = filename.rpartition(".")
    if not name_part:
        name_part, ext = ext, ""

    name_part = name_part.strip(". ")

    name_upper = name_part.upper()
    if name_upper in WINDOWS_RESERVED_NAMES:
        name_part = f"_{name_part}"

    if name_part.endswith(".") or name_part.endswith(" "):
        name_part = name_part.rstrip(". ") + "_"

    if ext:
        filename = f"{name_part}.{ext}"
    else:
        filename = name_part

    if not filename or filename == "." or filename == "..":
        filename = "_renamed"

    return filename


def get_unique_filename(directory, filename):
    path = directory / filename
    if not path.exists():
        return filename

    name, _, ext = filename.rpartition(".")
    if not name:
        name, ext = ext, ""

    counter = 1
    while True:
        if ext:
            new_name = f"{name}_{counter}.{ext}"
        else:
            new_name = f"{name}_{counter}"

        if not (directory / new_name).exists():
            return new_name
        counter += 1


def safe_sub(regex, replacement, string):
    match = regex.search(string)
    if match is None:
        return string

    def replace_fn(m):
        def get_group(n):
            try:
                val = m.group(n)
                return val if val is not None else ""
            except (IndexError, TypeError):
                return ""

        result = []
        i = 0
        pattern = re.compile(r'\\(\d+)')
        for m2 in pattern.finditer(replacement):
            result.append(replacement[i:m2.start()])
            result.append(get_group(int(m2.group(1))))
            i = m2.end()
        result.append(replacement[i:])
        return "".join(result)

    return regex.sub(replace_fn, string)


def check_path_length(directory, filename, max_length=240):
    full_path = str(directory / filename)
    if len(full_path) > max_length:
        name, _, ext = filename.rpartition(".")
        if not name:
            name, ext = ext, ""

        extra = len(full_path) - max_length + 4
        name = name[:max(1, len(name) - extra)] + "_trunc"

        if ext:
            return f"{name}.{ext}"
        return name
    return filename


def rename_files(pattern, replacement, directory, dry_run):
    try:
        regex = re.compile(pattern)
    except re.error as e:
        print(f"错误: 无效的正则表达式 - {e}", file=sys.stderr)
        sys.exit(1)

    dir_path = Path(directory).resolve()
    if not dir_path.is_dir():
        print(f"错误: 目录 '{directory}' 不存在", file=sys.stderr)
        sys.exit(1)

    renamed_count = 0
    skipped_count = 0

    files = sorted([p for p in dir_path.iterdir() if p.is_file()])

    for old_path in files:
        filename = old_path.name

        new_filename = safe_sub(regex, replacement, filename)
        if new_filename == filename:
            continue

        original_new = new_filename
        new_filename = sanitize_filename(new_filename)
        sanitized = new_filename != original_new

        new_filename = check_path_length(dir_path, new_filename)
        if not new_filename:
            print(f"跳过: '{filename}' (无法生成有效的目标文件名)", file=sys.stderr)
            skipped_count += 1
            continue

        new_filename = get_unique_filename(dir_path, new_filename)
        new_path = dir_path / new_filename

        if old_path.resolve() == new_path.resolve():
            continue

        info_parts = []
        if sanitized:
            info_parts.append("已清理非法字符")

        if info_parts:
            info = " (" + ", ".join(info_parts) + ")"
        else:
            info = ""

        if dry_run:
            print(f"[预览] '{filename}' -> '{new_filename}'{info}")
        else:
            try:
                new_path = old_path.rename(new_path)
                print(f"'{filename}' -> '{new_filename}'{info}")
                renamed_count += 1
            except OSError as e:
                print(f"错误: 无法重命名 '{filename}' - {e}", file=sys.stderr)

    if dry_run:
        print(f"\n预览完成，将重命名 {renamed_count} 个文件，跳过 {skipped_count} 个文件")
    else:
        print(f"\n完成，已重命名 {renamed_count} 个文件，跳过 {skipped_count} 个文件")


def main():
    args = parse_args()
    rename_files(
        args.pattern,
        args.replacement,
        args.directory,
        args.dry_run
    )


if __name__ == "__main__":
    main()
