#!/usr/bin/env python3

import pytest
from unittest.mock import Mock, patch, MagicMock
from packaging import version as pkg_version

from dep_updater import (
    Dependency,
    Vulnerability,
    RequirementsParser,
    PyProjectParser,
    PipfileParser,
    DependencyParserFactory,
    PyPIChecker,
    SafetyChecker,
    ReportGenerator,
    GitHubPRCreator
)


class TestDependency:
    def test_dependency_creation(self):
        dep = Dependency(name="requests", current_version="2.25.1")
        assert dep.name == "requests"
        assert dep.current_version == "2.25.1"
        assert dep.latest_version is None
        assert dep.needs_update is False
        assert dep.vulnerabilities == []

    def test_dependency_with_vulnerabilities(self):
        vuln = Vulnerability(
            cve="CVE-2023-1234",
            description="Test vulnerability",
            severity="high",
            affected_versions="<2.30.0"
        )
        dep = Dependency(
            name="requests",
            current_version="2.25.1",
            vulnerabilities=[vuln]
        )
        assert len(dep.vulnerabilities) == 1
        assert dep.vulnerabilities[0].cve == "CVE-2023-1234"


class TestRequirementsParser:
    def test_parse_requirements_txt(self, tmp_path):
        req_file = tmp_path / "requirements.txt"
        req_file.write_text("""
requests==2.25.1
flask==2.0.0
# This is a comment
numpy==1.21.0
""")
        
        dependencies = RequirementsParser.parse(str(req_file))
        assert len(dependencies) == 3
        
        dep_names = {d.name for d in dependencies}
        assert dep_names == {"requests", "flask", "numpy"}
        
        requests_dep = next(d for d in dependencies if d.name == "requests")
        assert requests_dep.current_version == "2.25.1"

    def test_parse_requirements_ignores_non_equal(self, tmp_path):
        req_file = tmp_path / "requirements.txt"
        req_file.write_text("""
requests>=2.25.0
flask~=2.0.0
numpy==1.21.0
""")
        
        dependencies = RequirementsParser.parse(str(req_file))
        assert len(dependencies) == 1
        assert dependencies[0].name == "numpy"


class TestPyProjectParser:
    def test_parse_pyproject_toml(self, tmp_path):
        toml_file = tmp_path / "pyproject.toml"
        toml_file.write_text("""
[tool.poetry]
name = "test-project"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.8"
requests = "==2.25.1"
flask = "^2.0.0"
numpy = "~1.21.0"
""")
        
        dependencies = PyProjectParser.parse(str(toml_file))
        assert len(dependencies) >= 2
        
        dep_names = {d.name for d in dependencies}
        assert "requests" in dep_names
        assert "python" not in dep_names


class TestPipfileParser:
    def test_parse_pipfile(self, tmp_path):
        pipfile = tmp_path / "Pipfile"
        pipfile.write_text("""
[[source]]
url = "https://pypi.org/simple"
verify_ssl = true
name = "pypi"

[packages]
requests = "==2.25.1"
flask = "==2.0.0"
django = "*"

[dev-packages]
pytest = "*"
""")
        
        dependencies = PipfileParser.parse(str(pipfile))
        assert len(dependencies) == 2
        
        dep_names = {d.name for d in dependencies}
        assert dep_names == {"requests", "flask"}


class TestDependencyParserFactory:
    def test_get_requirements_parser(self):
        parser = DependencyParserFactory.get_parser("path/to/requirements.txt")
        assert parser == RequirementsParser

    def test_get_pyproject_parser(self):
        parser = DependencyParserFactory.get_parser("path/to/pyproject.toml")
        assert parser == PyProjectParser

    def test_get_pipfile_parser(self):
        parser = DependencyParserFactory.get_parser("path/to/Pipfile")
        assert parser == PipfileParser

    def test_get_unknown_parser_raises(self):
        with pytest.raises(ValueError):
            DependencyParserFactory.get_parser("path/to/unknown.txt")


class MockResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP Error: {self.status_code}")


class TestPyPIChecker:
    @patch('requests.get')
    def test_get_latest_version_success(self, mock_get):
        mock_get.return_value = MockResponse({
            "info": {"version": "2.31.0"}
        })
        
        version = PyPIChecker.get_latest_version("requests")
        assert version == "2.31.0"
        mock_get.assert_called_once_with(
            "https://pypi.org/pypi/requests/json",
            timeout=10
        )

    @patch('requests.get')
    def test_get_latest_version_failure(self, mock_get):
        mock_get.return_value = MockResponse({}, 404)
        
        version = PyPIChecker.get_latest_version("nonexistent-package")
        assert version is None

    def test_version_comparison_minor_update(self):
        dependencies = [
            Dependency(name="requests", current_version="2.25.1")
        ]
        
        with patch.object(PyPIChecker, 'get_latest_version', return_value="2.31.0"):
            result = PyPIChecker.check_dependencies(dependencies, allow_major=False)
            
            assert result[0].latest_version == "2.31.0"
            assert result[0].needs_update is True

    def test_version_comparison_major_update_not_allowed(self):
        dependencies = [
            Dependency(name="requests", current_version="2.25.1")
        ]
        
        with patch.object(PyPIChecker, 'get_latest_version', return_value="3.0.0"):
            result = PyPIChecker.check_dependencies(dependencies, allow_major=False)
            
            assert result[0].latest_version == "3.0.0"
            assert result[0].needs_update is False

    def test_version_comparison_major_update_allowed(self):
        dependencies = [
            Dependency(name="requests", current_version="2.25.1")
        ]
        
        with patch.object(PyPIChecker, 'get_latest_version', return_value="3.0.0"):
            result = PyPIChecker.check_dependencies(dependencies, allow_major=True)
            
            assert result[0].latest_version == "3.0.0"
            assert result[0].needs_update is True

    def test_version_comparison_patch_update(self):
        dependencies = [
            Dependency(name="requests", current_version="2.31.0")
        ]
        
        with patch.object(PyPIChecker, 'get_latest_version', return_value="2.31.1"):
            result = PyPIChecker.check_dependencies(dependencies, allow_major=False)
            
            assert result[0].needs_update is True

    def test_version_comparison_same_version(self):
        dependencies = [
            Dependency(name="requests", current_version="2.31.0")
        ]
        
        with patch.object(PyPIChecker, 'get_latest_version', return_value="2.31.0"):
            result = PyPIChecker.check_dependencies(dependencies)
            
            assert result[0].needs_update is False


class TestSafetyChecker:
    @patch('requests.get')
    def test_check_vulnerabilities_found(self, mock_get):
        mock_get.return_value = MockResponse([{
            "cve": "CVE-2023-1234",
            "description": "Test vulnerability description",
            "severity": "high",
            "v": "<2.30.0"
        }])
        
        dependencies = [
            Dependency(name="requests", current_version="2.25.1")
        ]
        
        result = SafetyChecker.check_vulnerabilities(dependencies)
        
        assert len(result[0].vulnerabilities) == 1
        assert result[0].vulnerabilities[0].cve == "CVE-2023-1234"
        assert result[0].vulnerabilities[0].severity == "high"

    @patch('requests.get')
    def test_check_vulnerabilities_none(self, mock_get):
        mock_get.return_value = MockResponse([])
        
        dependencies = [
            Dependency(name="requests", current_version="2.31.0")
        ]
        
        result = SafetyChecker.check_vulnerabilities(dependencies)
        
        assert len(result[0].vulnerabilities) == 0


class TestReportGenerator:
    def test_generate_report_with_updates(self):
        dependencies = [
            Dependency(
                name="requests",
                current_version="2.25.1",
                latest_version="2.31.0",
                needs_update=True
            ),
            Dependency(
                name="flask",
                current_version="2.0.1",
                latest_version="2.0.1",
                needs_update=False
            )
        ]
        
        report = ReportGenerator.generate(dependencies, include_security=False)
        
        assert "# 依赖更新报告" in report
        assert "需要更新的依赖" in report
        assert "requests: 2.25.1 → 2.31.0" in report
        assert "已是最新版本" in report
        assert "flask: 2.0.1" in report

    def test_generate_report_with_vulnerabilities(self):
        vuln = Vulnerability(
            cve="CVE-2023-1234",
            description="Test vulnerability",
            severity="high",
            affected_versions="<2.30.0"
        )
        dependencies = [
            Dependency(
                name="requests",
                current_version="2.25.1",
                latest_version="2.31.0",
                needs_update=True,
                vulnerabilities=[vuln]
            )
        ]
        
        report = ReportGenerator.generate(dependencies, include_security=True)
        
        assert "安全漏洞警告" in report
        assert "CVE-2023-1234" in report
        assert "HIGH" in report
        assert "[有安全漏洞!]" in report

    def test_generate_report_to_file(self, tmp_path):
        output_file = tmp_path / "report.md"
        dependencies = [
            Dependency(
                name="requests",
                current_version="2.25.1",
                latest_version="2.31.0",
                needs_update=True
            )
        ]
        
        ReportGenerator.generate(dependencies, output_file=str(output_file), include_security=False)
        
        assert output_file.exists()
        content = output_file.read_text()
        assert "requests: 2.25.1 → 2.31.0" in content


class TestGitHubPRCreator:
    def setup_method(self):
        self.pr_creator = GitHubPRCreator(token="test-token", repo="owner/repo")

    @patch('requests.get')
    @patch('requests.post')
    def test_create_branch(self, mock_post, mock_get):
        mock_get.return_value = MockResponse({
            "object": {"sha": "abc123"}
        })
        mock_post.return_value = MockResponse({"ref": "refs/heads/test-branch"})
        
        branch = self.pr_creator.create_branch(base_branch="main")
        
        assert branch.startswith("dependency-updates-")
        mock_get.assert_called_once()
        mock_post.assert_called_once()
        
        post_data = mock_post.call_args[1]["json"]
        assert post_data["sha"] == "abc123"
        assert post_data["ref"].startswith("refs/heads/dependency-updates-")

    @patch('requests.get')
    @patch('requests.put')
    def test_update_requirements_txt(self, mock_put, mock_get):
        import base64
        
        original_content = "requests==2.25.1\nflask==2.0.0\n"
        encoded_content = base64.b64encode(original_content.encode()).decode()
        
        mock_get.return_value = MockResponse({
            "content": encoded_content,
            "sha": "file-sha-123"
        })
        mock_put.return_value = MockResponse({"content": {}})
        
        dependencies = [
            Dependency(
                name="requests",
                current_version="2.25.1",
                latest_version="2.31.0",
                needs_update=True
            )
        ]
        
        self.pr_creator.update_requirements(dependencies, "test-branch", "requirements.txt")
        
        put_data = mock_put.call_args[1]["json"]
        updated_content = base64.b64decode(put_data["content"]).decode()
        
        assert "requests==2.31.0" in updated_content
        assert "flask==2.0.0" in updated_content
        assert put_data["branch"] == "test-branch"
        assert put_data["sha"] == "file-sha-123"

    @patch('requests.get')
    @patch('requests.put')
    def test_update_pyproject_toml(self, mock_put, mock_get):
        import base64
        
        original_content = '[tool.poetry.dependencies]\nrequests = "==2.25.1"\nflask = "==2.0.0"\n'
        encoded_content = base64.b64encode(original_content.encode()).decode()
        
        mock_get.return_value = MockResponse({
            "content": encoded_content,
            "sha": "file-sha-123"
        })
        mock_put.return_value = MockResponse({"content": {}})
        
        dependencies = [
            Dependency(
                name="requests",
                current_version="2.25.1",
                latest_version="2.31.0",
                needs_update=True
            )
        ]
        
        self.pr_creator.update_requirements(dependencies, "test-branch", "pyproject.toml")
        
        put_data = mock_put.call_args[1]["json"]
        updated_content = base64.b64decode(put_data["content"]).decode()
        
        assert 'requests = "==2.31.0"' in updated_content

    @patch('requests.post')
    def test_create_pr(self, mock_post):
        mock_post.return_value = MockResponse({
            "html_url": "https://github.com/owner/repo/pull/1"
        })
        
        pr_url = self.pr_creator.create_pr(
            head="test-branch",
            base="main",
            title="Test PR",
            body="Test body"
        )
        
        assert pr_url == "https://github.com/owner/repo/pull/1"
        post_data = mock_post.call_args[1]["json"]
        assert post_data["title"] == "Test PR"
        assert post_data["head"] == "test-branch"
        assert post_data["base"] == "main"
        assert post_data["body"] == "Test body"

    @patch('requests.post')
    def test_create_pr_default_title(self, mock_post):
        mock_post.return_value = MockResponse({
            "html_url": "https://github.com/owner/repo/pull/1"
        })
        
        self.pr_creator.create_pr(head="test-branch", base="develop")
        
        post_data = mock_post.call_args[1]["json"]
        assert post_data["title"] == "Update dependencies to latest versions"
        assert post_data["base"] == "develop"


class TestIntegration:
    @patch('requests.get')
    def test_full_workflow_no_major_updates(self, mock_get):
        def mock_response(url, **kwargs):
            if "pypi.org" in url:
                if "requests" in url:
                    return MockResponse({"info": {"version": "3.0.0"}})
                elif "flask" in url:
                    return MockResponse({"info": {"version": "2.1.0"}})
            elif "pyup.io" in url:
                return MockResponse([])
            return MockResponse({}, 404)
        
        mock_get.side_effect = mock_response
        
        dependencies = [
            Dependency(name="requests", current_version="2.25.1"),
            Dependency(name="flask", current_version="2.0.0")
        ]
        
        dependencies = PyPIChecker.check_dependencies(dependencies, allow_major=False)
        dependencies = SafetyChecker.check_vulnerabilities(dependencies)
        
        assert dependencies[0].needs_update is False
        assert dependencies[1].needs_update is True
