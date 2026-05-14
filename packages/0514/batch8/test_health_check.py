import pytest
import responses
import json
import sys
import time
from unittest.mock import patch, MagicMock

import health_check


@responses.activate
def test_check_url_success():
    responses.add(responses.GET, 'http://example.com', status=200, body='Hello World')
    
    result = health_check.check_url('http://example.com', timeout=5)
    
    assert result.success is True
    assert result.status_code == 200
    assert result.error is None
    assert result.response_time > 0


@responses.activate
def test_check_url_with_keyword_found():
    responses.add(responses.GET, 'http://example.com', status=200, body='Hello World')
    
    result = health_check.check_url('http://example.com', keyword='Hello', timeout=5)
    
    assert result.success is True
    assert result.keyword_found is True


@responses.activate
def test_check_url_with_keyword_not_found():
    responses.add(responses.GET, 'http://example.com', status=200, body='Hello World')
    
    result = health_check.check_url('http://example.com', keyword='NotFound', timeout=5)
    
    assert result.success is False
    assert result.keyword_found is False


@responses.activate
def test_check_url_404_error():
    responses.add(responses.GET, 'http://example.com', status=404)
    
    result = health_check.check_url('http://example.com', timeout=5)
    
    assert result.success is False
    assert result.status_code == 404
    assert 'HTTPError' in result.error


@responses.activate
def test_check_url_500_error():
    responses.add(responses.GET, 'http://example.com', status=500)
    
    result = health_check.check_url('http://example.com', timeout=5)
    
    assert result.success is False
    assert result.status_code == 500


def test_check_url_connection_error():
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_urlopen.side_effect = Exception('Connection refused')
        
        result = health_check.check_url('http://nonexistent.example', timeout=5)
        
        assert result.success is False
        assert result.status_code is None
        assert 'Connection refused' in result.error


@responses.activate
def test_main_success(capsys):
    responses.add(responses.GET, 'http://example.com', status=200, body='OK')
    
    test_args = ['health_check.py', '--urls', 'http://example.com']
    with patch.object(sys, 'argv', test_args):
        with pytest.raises(SystemExit) as excinfo:
            health_check.main()
        
        assert excinfo.value.code == 0
        
        captured = capsys.readouterr()
        report = json.loads(captured.out)
        assert report['success_count'] == 1
        assert report['failure_count'] == 0


@responses.activate
def test_main_failure():
    responses.add(responses.GET, 'http://example.com', status=500)
    
    test_args = ['health_check.py', '--urls', 'http://example.com']
    with patch.object(sys, 'argv', test_args):
        with pytest.raises(SystemExit) as excinfo:
            health_check.main()
        
        assert excinfo.value.code == 1


@responses.activate
def test_main_multiple_urls(capsys):
    responses.add(responses.GET, 'http://example1.com', status=200, body='OK')
    responses.add(responses.GET, 'http://example2.com', status=500)
    responses.add(responses.GET, 'http://example3.com', status=200, body='Hello')
    
    test_args = ['health_check.py', '--urls', 'http://example1.com', 'http://example2.com', 'http://example3.com']
    with patch.object(sys, 'argv', test_args):
        with pytest.raises(SystemExit) as excinfo:
            health_check.main()
        
        assert excinfo.value.code == 1
        
        captured = capsys.readouterr()
        report = json.loads(captured.out)
        assert report['total_urls'] == 3
        assert report['success_count'] == 2
        assert report['failure_count'] == 1


@responses.activate
def test_main_output_to_file(tmp_path):
    responses.add(responses.GET, 'http://example.com', status=200, body='OK')
    
    output_file = tmp_path / 'report.json'
    test_args = ['health_check.py', '--urls', 'http://example.com', '--output', str(output_file)]
    
    with patch.object(sys, 'argv', test_args):
        with pytest.raises(SystemExit):
            health_check.main()
    
    assert output_file.exists()
    with open(output_file, 'r') as f:
        report = json.load(f)
        assert report['success_count'] == 1


@responses.activate
def test_main_with_keyword(capsys):
    responses.add(responses.GET, 'http://example.com', status=200, body='Welcome to the site')
    
    test_args = ['health_check.py', '--urls', 'http://example.com', '--keyword', 'Welcome']
    with patch.object(sys, 'argv', test_args):
        with pytest.raises(SystemExit) as excinfo:
            health_check.main()
        
        assert excinfo.value.code == 0
        
        captured = capsys.readouterr()
        report = json.loads(captured.out)
        assert report['results'][0]['keyword_found'] is True
