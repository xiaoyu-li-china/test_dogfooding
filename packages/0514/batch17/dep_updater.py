#!/usr/bin/env python3

import argparse
import base64
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from packaging import version as pkg_version
import requests

try:
    import tomllib
except ImportError:
    import tomli as tomllib


@dataclass
class Vulnerability:
    cve: str
    description: str
    severity: str
    affected_versions: str


@dataclass
class Dependency:
    name: str
    current_version: str
    latest_version: Optional[str] = None
    needs_update: bool = False
    vulnerabilities: List[Vulnerability] = field(default_factory=list)
    source_file: str = ""


class RequirementsParser:
    VERSION_PATTERN = re.compile(r'^([a-zA-Z0-9_-]+)([=<>!~]+)(.+)$')

    @staticmethod
    def parse(file_path: str) -> List[Dependency]:
        dependencies = []
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                match = RequirementsParser.VERSION_PATTERN.match(line)
                if match:
                    name, operator, version = match.groups()
                    if operator == '==':
                        dependencies.append(Dependency(
                            name=name,
                            current_version=version,
                            source_file=file_path
                        ))
        
        return dependencies


class PyProjectParser:
    VERSION_PATTERN = re.compile(r'^[=<>!~]*([0-9.]+)')

    @staticmethod
    def parse(file_path: str) -> List[Dependency]:
        dependencies = []
        with open(file_path, 'rb') as f:
            data = tomllib.load(f)
        
        poetry_deps = data.get('tool', {}).get('poetry', {}).get('dependencies', {})
        for name, version_spec in poetry_deps.items():
            if name.lower() == 'python':
                continue
            
            if isinstance(version_spec, str):
                version_match = PyProjectParser.VERSION_PATTERN.search(version_spec)
                if version_match:
                    dependencies.append(Dependency(
                        name=name,
                        current_version=version_match.group(1),
                        source_file=file_path
                    ))
            elif isinstance(version_spec, dict):
                version_str = version_spec.get('version', '')
                version_match = PyProjectParser.VERSION_PATTERN.search(version_str)
                if version_match:
                    dependencies.append(Dependency(
                        name=name,
                        current_version=version_match.group(1),
                        source_file=file_path
                    ))
        
        return dependencies


class PipfileParser:
    VERSION_PATTERN = re.compile(r'^[=<>!~]*([0-9.]+)')

    @staticmethod
    def parse(file_path: str) -> List[Dependency]:
        dependencies = []
        with open(file_path, 'rb') as f:
            data = tomllib.load(f)
        
        packages = data.get('packages', {})
        for name, version_spec in packages.items():
            if isinstance(version_spec, str) and version_spec != '*':
                version_match = PipfileParser.VERSION_PATTERN.search(version_spec)
                if version_match:
                    dependencies.append(Dependency(
                        name=name,
                        current_version=version_match.group(1),
                        source_file=file_path
                    ))
        
        return dependencies


class DependencyParserFactory:
    @staticmethod
    def get_parser(file_path: str):
        filename = os.path.basename(file_path)
        if filename == 'requirements.txt':
            return RequirementsParser
        elif filename == 'pyproject.toml':
            return PyProjectParser
        elif filename == 'Pipfile':
            return PipfileParser
        else:
            raise ValueError(f"不支持的文件格式: {filename}")


class PyPIChecker:
    BASE_URL = "https://pypi.org/pypi/{package}/json"

    @staticmethod
    def get_latest_version(package_name: str) -> Optional[str]:
        try:
            url = PyPIChecker.BASE_URL.format(package=package_name)
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data['info']['version']
        except Exception as e:
            print(f"Error checking {package_name}: {str(e)}")
            return None

    @staticmethod
    def check_dependencies(dependencies: List[Dependency], allow_major: bool = False) -> List[Dependency]:
        for dep in dependencies:
            latest = PyPIChecker.get_latest_version(dep.name)
            if latest:
                dep.latest_version = latest
                try:
                    current = pkg_version.parse(dep.current_version)
                    latest_ver = pkg_version.parse(latest)
                    if latest_ver > current:
                        if allow_major:
                            dep.needs_update = True
                        else:
                            if current.major == latest_ver.major:
                                dep.needs_update = True
                            else:
                                dep.needs_update = False
                except Exception:
                    dep.needs_update = latest != dep.current_version
        return dependencies


class SafetyChecker:
    SAFETY_API_URL = "https://pyup.io/api/v1/safety/{package}/{version}/"

    @staticmethod
    def check_vulnerabilities(dependencies: List[Dependency]) -> List[Dependency]:
        for dep in dependencies:
            try:
                url = SafetyChecker.SAFETY_API_URL.format(
                    package=dep.name,
                    version=dep.current_version
                )
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for vuln_data in data:
                        vuln = Vulnerability(
                            cve=vuln_data.get('cve', ''),
                            description=vuln_data.get('description', ''),
                            severity=vuln_data.get('severity', 'unknown'),
                            affected_versions=vuln_data.get('v', '')
                        )
                        dep.vulnerabilities.append(vuln)
            except Exception as e:
                print(f"检查 {dep.name} 安全漏洞时出错: {str(e)}")
        return dependencies


class ReportGenerator:
    @staticmethod
    def generate(dependencies: List[Dependency], output_file: Optional[str] = None, include_security: bool = True) -> str:
        report_lines = []
        report_lines.append("# 依赖更新报告")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 60)
        report_lines.append("")
        
        updates_needed = [d for d in dependencies if d.needs_update]
        no_updates = [d for d in dependencies if not d.needs_update and d.latest_version]
        errors = [d for d in dependencies if not d.latest_version]
        has_vulnerabilities = [d for d in dependencies if d.vulnerabilities]

        if include_security and has_vulnerabilities:
            total_vulns = sum(len(d.vulnerabilities) for d in has_vulnerabilities)
            report_lines.append(f"## ⚠️  安全漏洞警告 ({total_vulns} 个):")
            report_lines.append("")
            for dep in has_vulnerabilities:
                report_lines.append(f"### {dep.name} ({dep.current_version}):")
                for vuln in dep.vulnerabilities:
                    report_lines.append(f"- **{vuln.severity.upper()}**: {vuln.description}")
                    if vuln.cve:
                        report_lines.append(f"  CVE: {vuln.cve}")
                report_lines.append("")

        if updates_needed:
            report_lines.append(f"## 需要更新的依赖 ({len(updates_needed)}):")
            report_lines.append("")
            for dep in updates_needed:
                vuln_note = " [有安全漏洞!]" if dep.vulnerabilities else ""
                report_lines.append(f"- {dep.name}: {dep.current_version} → {dep.latest_version}{vuln_note}")
            report_lines.append("")

        if no_updates:
            report_lines.append(f"## 已是最新版本 ({len(no_updates)}):")
            report_lines.append("")
            for dep in no_updates:
                report_lines.append(f"- {dep.name}: {dep.current_version}")
            report_lines.append("")

        if errors:
            report_lines.append(f"## 检查失败 ({len(errors)}):")
            report_lines.append("")
            for dep in errors:
                report_lines.append(f"- {dep.name}: 无法获取最新版本")
            report_lines.append("")

        report = "\n".join(report_lines)
        
        if output_file:
            with open(output_file, 'w') as f:
                f.write(report)
            print(f"报告已保存到: {output_file}")
        
        return report


class GitHubPRCreator:
    def __init__(self, token: str, repo: str):
        self.token = token
        self.repo = repo
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def create_branch(self, base_branch: str = "main") -> str:
        branch_name = f"dependency-updates-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        url = f"{self.base_url}/repos/{self.repo}/git/ref/heads/{base_branch}"
        
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        sha = response.json()['object']['sha']

        url = f"{self.base_url}/repos/{self.repo}/git/refs"
        data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": sha
        }
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        
        return branch_name

    def update_requirements(self, dependencies: List[Dependency], branch: str, file_path: str):
        url = f"{self.base_url}/repos/{self.repo}/contents/{file_path}"
        
        response = requests.get(url, headers=self.headers, params={"ref": branch})
        response.raise_for_status()
        content = response.json()
        sha = content['sha']
        
        content_lines = content['content']
        content_lines = base64.b64decode(content_lines).decode('utf-8')
        
        filename = os.path.basename(file_path)
        if filename == 'requirements.txt':
            new_content = self._update_requirements_txt(content_lines, dependencies)
        elif filename == 'pyproject.toml':
            new_content = self._update_pyproject_toml(content_lines, dependencies)
        elif filename == 'Pipfile':
            new_content = self._update_pipfile(content_lines, dependencies)
        else:
            new_content = content_lines
        
        content_b64 = base64.b64encode(new_content.encode('utf-8')).decode('utf-8')
        
        data = {
            "message": "Update dependencies",
            "content": content_b64,
            "sha": sha,
            "branch": branch
        }
        response = requests.put(url, headers=self.headers, json=data)
        response.raise_for_status()

    def _update_requirements_txt(self, content: str, dependencies: List[Dependency]) -> str:
        new_lines = []
        for line in content.split('\n'):
            line_stripped = line.strip()
            if line_stripped and not line_stripped.startswith('#'):
                for dep in dependencies:
                    if dep.needs_update and line_stripped.startswith(f"{dep.name}=="):
                        line = f"{dep.name}=={dep.latest_version}"
                        break
            new_lines.append(line)
        return '\n'.join(new_lines)

    def _update_pyproject_toml(self, content: str, dependencies: List[Dependency]) -> str:
        new_lines = []
        for line in content.split('\n'):
            line_stripped = line.strip()
            for dep in dependencies:
                if dep.needs_update and line_stripped.startswith(f"{dep.name}") and '=' in line_stripped:
                    line = re.sub(r'==[0-9.]+', f'=={dep.latest_version}', line)
                    break
            new_lines.append(line)
        return '\n'.join(new_lines)

    def _update_pipfile(self, content: str, dependencies: List[Dependency]) -> str:
        new_lines = []
        for line in content.split('\n'):
            line_stripped = line.strip()
            for dep in dependencies:
                if dep.needs_update and line_stripped.startswith(f"{dep.name}") and '=' in line_stripped:
                    line = re.sub(r'==[0-9.]+', f'=={dep.latest_version}', line)
                    break
            new_lines.append(line)
        return '\n'.join(new_lines)

    def create_pr(self, head: str, base: str = "main", title: str = None, body: str = None) -> str:
        url = f"{self.base_url}/repos/{self.repo}/pulls"
        
        if not title:
            title = "Update dependencies to latest versions"
        
        data = {
            "title": title,
            "head": head,
            "base": base,
            "body": body or "Automated dependency updates"
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()['html_url']


def main():
    parser = argparse.ArgumentParser(description="PyPI 依赖更新检查器")
    parser.add_argument("--file", default="requirements.txt", help="依赖文件路径 (requirements.txt, pyproject.toml, 或 Pipfile)")
    parser.add_argument("--report", help="输出报告文件路径")
    parser.add_argument("--no-security", action="store_true", help="跳过安全漏洞检查")
    parser.add_argument("--allow-major", action="store_true", help="允许升级 major 版本（默认只升级 minor/patch）")
    parser.add_argument("--create-pr", action="store_true", help="是否创建 GitHub PR")
    parser.add_argument("--github-token", help="GitHub Token")
    parser.add_argument("--github-repo", help="GitHub 仓库 (owner/repo)")
    parser.add_argument("--base-branch", default="main", help="基础分支")
    
    args = parser.parse_args()
    
    github_token = args.github_token or os.environ.get("GITHUB_TOKEN")
    github_repo = args.github_repo or os.environ.get("GITHUB_REPOSITORY")
    if not github_repo and os.environ.get("GITHUB_ACTION"):
        print("警告: GITHUB_REPOSITORY 环境变量未设置，将尝试从 git 配置中获取")

    print(f"正在读取 {args.file}...")
    try:
        parser_cls = DependencyParserFactory.get_parser(args.file)
        dependencies = parser_cls.parse(args.file)
        print(f"找到 {len(dependencies)} 个依赖项")
    except FileNotFoundError:
        print(f"错误: 找不到文件 {args.file}")
        sys.exit(1)
    except ValueError as e:
        print(f"错误: {str(e)}")
        sys.exit(1)

    print("\n正在检查 PyPI 最新版本...")
    dependencies = PyPIChecker.check_dependencies(dependencies, allow_major=args.allow_major)

    if not args.no_security:
        print("\n正在检查安全漏洞...")
        dependencies = SafetyChecker.check_vulnerabilities(dependencies)
        vuln_count = sum(len(d.vulnerabilities) for d in dependencies)
        if vuln_count > 0:
            print(f"发现 {vuln_count} 个安全漏洞!")
        else:
            print("未发现安全漏洞")

    print("\n生成更新报告...")
    report = ReportGenerator.generate(dependencies, args.report, include_security=not args.no_security)
    print(report)

    if args.create_pr or os.environ.get("GITHUB_ACTION"):
        if not github_token or not github_repo:
            print("\n错误: 创建 PR 需要 GITHUB_TOKEN 环境变量或 --github-token 参数")
            print("同时需要 GITHUB_REPOSITORY 环境变量或 --github-repo 参数")
            return
        
        updates_available = any(d.needs_update for d in dependencies)
        if not updates_available:
            print("\n没有需要更新的依赖，跳过创建 PR")
            return
        
        print(f"\n正在为仓库 {github_repo} 创建 GitHub PR...")
        try:
            pr_creator = GitHubPRCreator(github_token, github_repo)
            branch = pr_creator.create_branch(args.base_branch)
            print(f"创建分支: {branch}")
            pr_creator.update_requirements(dependencies, branch, args.file)
            pr_url = pr_creator.create_pr(branch, args.base_branch, body=report)
            print(f"PR 创建成功: {pr_url}")
            
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a") as f:
                    f.write(f"pr-url={pr_url}\n")
                    f.write(f"report={report}\n")
        except Exception as e:
            print(f"创建 PR 失败: {str(e)}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
