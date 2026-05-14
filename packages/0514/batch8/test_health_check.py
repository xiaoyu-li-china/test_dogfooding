import pytest
import responses
import json
import os
import time
from health_check import (
    check_url,
    load_failure_counts,
    save_failure_counts,
    update_failure_count,
    should_send_alert,
    send_dingtalk_alert,
    send_wechat_alert,
    FAILURE_COUNT_FILE,
    ALERT_THRESHOLD
)


@pytest.fixture(autouse=True)
def cleanup_failure_file():
    if os.path.exists(FAILURE_COUNT_FILE):
        os.remove(FAILURE_COUNT_FILE)
    yield
    if os.path.exists(FAILURE_COUNT_FILE):
        os.remove(FAILURE_COUNT_FILE)


class TestCheckUrl:
    @responses.activate
    def test_check_url_success(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="OK")
        
        result = check_url(url)
        
        assert result["success"] is True
        assert result["status_code"] == 200
        assert result["response_time"] > 0
        assert len(result["errors"]) == 0
    
    @responses.activate
    def test_check_url_with_keyword_success(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="Welcome to Example")
        
        result = check_url(url, keywords=["Welcome"])
        
        assert result["success"] is True
    
    @responses.activate
    def test_check_url_keyword_missing(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="Hello World")
        
        result = check_url(url, keywords=["Welcome"])
        
        assert result["success"] is False
        assert "Keyword not found: 'Welcome'" in result["errors"]
    
    @responses.activate
    def test_check_url_404_error(self):
        url = "https://example.com/notfound"
        responses.add(responses.GET, url, status=404)
        
        result = check_url(url)
        
        assert result["success"] is False
        assert result["status_code"] == 404
        assert "HTTP status code: 404" in result["errors"]
    
    @responses.activate
    def test_check_url_500_error(self):
        url = "https://example.com/error"
        responses.add(responses.GET, url, status=500)
        
        result = check_url(url)
        
        assert result["success"] is False
        assert result["status_code"] == 500
        assert "HTTP status code: 500" in result["errors"]
    
    def test_check_url_connection_error(self):
        url = "https://nonexistent.example.invalid"
        
        result = check_url(url, timeout=1)
        
        assert result["success"] is False
        assert len(result["errors"]) > 0
        assert "Request failed:" in result["errors"][0]
    
    @responses.activate
    def test_check_url_multiple_keywords(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="Hello World API")
        
        result = check_url(url, keywords=["Hello", "API"])
        
        assert result["success"] is True
    
    @responses.activate
    def test_check_url_one_keyword_missing(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="Hello World")
        
        result = check_url(url, keywords=["Hello", "API"])
        
        assert result["success"] is False
        assert "Keyword not found: 'API'" in result["errors"]


class TestFailurePersistence:
    def test_load_empty_failure_counts(self):
        counts = load_failure_counts()
        assert counts == {}
    
    def test_save_and_load_failure_counts(self):
        test_data = {
            "https://example.com": {
                "consecutive_failures": 2,
                "last_alert_time": 1234567890,
                "last_status": "failed"
            }
        }
        
        save_failure_counts(test_data)
        loaded = load_failure_counts()
        
        assert loaded == test_data
    
    def test_update_failure_count_success(self):
        url = "https://example.com"
        
        stats = update_failure_count(url, success=True)
        
        assert stats["consecutive_failures"] == 0
        assert stats["last_status"] == "success"
        
        counts = load_failure_counts()
        assert url in counts
    
    def test_update_failure_count_failure(self):
        url = "https://example.com"
        
        stats = update_failure_count(url, success=False)
        
        assert stats["consecutive_failures"] == 1
        assert stats["last_status"] == "failed"
    
    def test_update_failure_count_multiple_failures(self):
        url = "https://example.com"
        
        update_failure_count(url, success=False)
        update_failure_count(url, success=False)
        stats = update_failure_count(url, success=False)
        
        assert stats["consecutive_failures"] == 3
    
    def test_update_failure_count_reset_on_success(self):
        url = "https://example.com"
        
        update_failure_count(url, success=False)
        update_failure_count(url, success=False)
        stats = update_failure_count(url, success=True)
        
        assert stats["consecutive_failures"] == 0


class TestAlertLogic:
    def test_should_not_alert_below_threshold(self):
        stats = {"consecutive_failures": 2, "last_alert_time": 0}
        assert should_send_alert(stats) is False
    
    def test_should_alert_at_threshold(self):
        stats = {"consecutive_failures": 3, "last_alert_time": 0}
        assert should_send_alert(stats) is True
    
    def test_should_not_alert_within_cooldown(self):
        current_time = time.time()
        stats = {"consecutive_failures": 3, "last_alert_time": current_time - 1800}
        assert should_send_alert(stats) is False
    
    def test_should_alert_after_cooldown(self):
        current_time = time.time()
        stats = {"consecutive_failures": 3, "last_alert_time": current_time - 7200}
        assert should_send_alert(stats) is True


class TestWebhookAlerts:
    @responses.activate
    def test_send_dingtalk_alert_success(self):
        webhook = "https://dingtalk.example.com/webhook"
        responses.add(responses.POST, webhook, status=200)
        
        result = send_dingtalk_alert(
            webhook,
            "https://example.com",
            ["HTTP status code: 500"],
            3
        )
        
        assert result is True
        assert len(responses.calls) == 1
    
    @responses.activate
    def test_send_dingtalk_alert_failure(self):
        webhook = "https://dingtalk.example.com/webhook"
        responses.add(responses.POST, webhook, status=500)
        
        result = send_dingtalk_alert(
            webhook,
            "https://example.com",
            ["Connection error"],
            3
        )
        
        assert result is False
    
    @responses.activate
    def test_send_wechat_alert_success(self):
        webhook = "https://qyapi.weixin.qq.com/webhook"
        responses.add(responses.POST, webhook, status=200)
        
        result = send_wechat_alert(
            webhook,
            "https://example.com",
            ["HTTP status code: 500"],
            3
        )
        
        assert result is True
        assert len(responses.calls) == 1
    
    @responses.activate
    def test_send_wechat_alert_failure(self):
        webhook = "https://qyapi.weixin.qq.com/webhook"
        responses.add(responses.POST, webhook, status=404)
        
        result = send_wechat_alert(
            webhook,
            "https://example.com",
            ["Connection error"],
            3
        )
        
        assert result is False


class TestIntegration:
    @responses.activate
    def test_full_success_scenario(self):
        url = "https://example.com"
        responses.add(responses.GET, url, status=200, body="OK")
        
        result = check_url(url)
        stats = update_failure_count(url, result["success"])
        
        assert result["success"] is True
        assert stats["consecutive_failures"] == 0
        assert should_send_alert(stats) is False
    
    @responses.activate
    def test_alert_trigger_after_3_failures(self):
        url = "https://example.com"
        
        for i in range(3):
            responses.add(responses.GET, url, status=500)
            result = check_url(url)
            stats = update_failure_count(url, result["success"])
        
        assert stats["consecutive_failures"] == 3
        assert should_send_alert(stats) is True
    
    @responses.activate
    def test_alert_not_trigger_before_3_failures(self):
        url = "https://example.com"
        
        for i in range(2):
            responses.add(responses.GET, url, status=500)
            result = check_url(url)
            stats = update_failure_count(url, result["success"])
        
        assert stats["consecutive_failures"] == 2
        assert should_send_alert(stats) is False
