#!/usr/bin/env python3
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime


DEFAULT_EXTENSION_MAP = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
    'Documents': ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt'],
    'Spreadsheets': ['.xlsx', '.xls', '.csv', '.ods'],
    'Presentations': ['.pptx', '.ppt', '.odp'],
    'Videos': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
    'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
    'Code': ['.py', '.js', '.ts', '.html', '.css', '.java', '.c', '.cpp', '.go', '.rs'],
}


def load_rules(config_path):
    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    return config


def get_date_path(file_path, date_pattern):
    stat = file_path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime)
    return mtime.strftime(date_pattern)


def get_target_path(file_path, extension, config):
    rules = config.get('rules', None)
    
    if rules:
        for rule in rules:
            folder = rule.get('folder', 'Others')
            extensions = [ext.lower() for ext in rule.get('extensions', [])]
            subfolder = rule.get('subfolder', None)
            
            if extension.lower() in extensions:
                target_path = Path(folder)
                if subfolder:
                    subfolder_type = subfolder.get('type', None)
                    if subfolder_type == 'date':
                        date_pattern = subfolder.get('pattern', '%Y-%m')
                        date_path = get_date_path(file_path, date_pattern)
                        target_path = target_path / date_path
                return target_path
    else:
        for folder, exts in DEFAULT_EXTENSION_MAP.items():
            if extension.lower() in exts:
                return Path(folder)
    
    return Path('Others')


def organize_directory(directory, dry_run=False, config=None):
    directory = Path(directory)
    script_path = Path(__file__).resolve()

    moved = []

    for item in directory.iterdir():
        if item.is_file() and item.resolve() != script_path:
            extension = item.suffix
            target_path = get_target_path(item, extension, config or {})
            target_dir = directory / target_path

            source_path = item
            dest_path = target_dir / item.name

            moved.append({
                'source': source_path,
                'dest': dest_path,
            })

            if not dry_run:
                target_dir.mkdir(parents=True, exist_ok=True)
                if dest_path.exists():
                    base, suffix = dest_path.stem, dest_path.suffix
                    counter = 1
                    while dest_path.exists():
                        dest_path = target_dir / f"{base}_{counter}{suffix}"
                        counter += 1
                shutil.move(str(source_path), str(dest_path))

    return moved


def main():
    parser = argparse.ArgumentParser(
        description='Organize files in current directory by extension'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview move operations without actually moving files'
    )
    parser.add_argument(
        '--rules',
        type=str,
        default=None,
        help='Path to JSON rules configuration file'
    )

    args = parser.parse_args()
    current_dir = Path.cwd()

    config = {}
    if args.rules:
        try:
            config = load_rules(args.rules)
        except Exception as e:
            print(f"Error loading rules: {e}")
            return

    moved = organize_directory(current_dir, dry_run=args.dry_run, config=config)

    if args.dry_run:
        print(f"Dry run - previewing moves in {current_dir}:")
        if not moved:
            print("  No files to organize.")
        else:
            for item in moved:
                relative_dest = item['dest'].parent.relative_to(current_dir)
                print(f"  {item['source'].name} -> {relative_dest}/")
    else:
        print(f"Organized files in {current_dir}:")
        if not moved:
            print("  No files were moved.")
        else:
            for item in moved:
                relative_dest = item['dest'].parent.relative_to(current_dir)
                print(f"  Moved: {item['source'].name} -> {relative_dest}/")


if __name__ == '__main__':
    main()
