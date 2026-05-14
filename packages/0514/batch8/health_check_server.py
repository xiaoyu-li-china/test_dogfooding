#!/usr/bin/env python3
import sys
import json
import time
import argparse
import requests
import os
import threading
from typing import List, Dict, Any
from flask import Flask
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST


app = Flask(__name__)


FAILURE_COUNT_FILE = "/data/failure_counts.json"
ALERT_THRESHOLD = 3


HEALTH_CHECK_REQUESTS = Counter(
    'health_check_requests_total',
    'Total number of health check requests',
    ['url', 'status']
)

HEALTH_CHECK_CONSECUTIVE_FAILURES = Gauge(
    'health_check_consecutive_failures',
    'Number of consecutive failures',
    ['url']
)

HEALTH_CHECK_RESPONSE_TIME = Histogram(
    'health_check_response_time_seconds',
    'Response time in seconds',
    ['url'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

HEALTH_CHECK_STATUS = Gauge(
    'health_check_status',
    'Health check status (1=success, 0=failure)',
    ['url']
)

HEALTH_CHECK_LAST_TIMESTAMP = Gauge(
    'health_check_last_timestamp',
    'Timestamp of last health check',
    ['url']
)

HEALTH_CHECK_ALERTS_TOTAL = Counter(
    'health_check_alerts_total',
    'Total number of alerts sent',
    ['url', 'type']
)


def load_failure_counts() -> Dict[str, Dict[str, Any]]:
    if os.path.exists(FAILURE_COUNT_FILE):
        try:
            with open(FAILURE_COUNT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_failure_counts(counts: Dict[str, Dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(FAILURE_COUNT_FILE), exist_ok=True)
    with open(FAILURE_COUNT_FILE, "w", encoding="utf-8") as f:
        json.dump(counts, f, indent=2, ensure_ascii=False)


def update_failure_count(url: str, success: bool) -> Dict[str, Any]:
    counts = load_failure_counts()
    
    if url not in counts:
        counts[url] = {"consecutive_failures": 0, "last_alert_time": 0, "last_status": None}
    
    if success:
        counts[url]["consecutive_failures"] = 0
        counts[url]["last_status"] = "success"
    else:
        counts[url]["consecutive_failures"] += 1
        counts[url]["last_status"] = "failed"
    
    save_failure_counts(counts)
    
    HEALTH_CHECK_CONSECUTIVE_FAILURES.labels(url=url).set(counts[url]["consecutive_failures"])
    
    return counts[url]


def should_send_alert(url_stats: Dict[str, Any]) -> bool:
    consecutive = url_stats["consecutive_failures"]
    last_alert = url_stats["last_alert_time"]
    current_time = time.time()
    
    if consecutive >= ALERT_THRESHOLD:
        if current_time - last_alert > 3600:
            return True
    return False


def update_alert_time(url: str) -> None:
    counts = load_failure_counts()
    if url in counts:
        counts[url]["last_alert_time"] = time.time()
        save_failure_counts(counts)


def send_dingtalk_alert(webhook: str, url: str, errors: List[str], consecutive: int) -> bool:
    message = {
        "msgtype": "markdown",
        "markdown": {
            "title": "服务告警",
            "text": f"### ⚠️ HTTP 服务告警\n\n**URL**: {url}\n\n**连续失败次数**: {consecutive}\n\n**错误信息**:\n" + 
                    "\n".join([f"- {err}" for err in errors]) + 
                    f"\n\n**告警时间**: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}"
        }
    }
    
    try:
        response = requests.post(webhook, json=message, timeout=10)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def send_wechat_alert(webhook: str, url: str, errors: List[str], consecutive: int) -> bool:
    message = {
        "msgtype": "markdown",
        "markdown": {
            "content": f"### ⚠️ HTTP 服务告警\n\n**URL**: <font color=\"warning\">{url}</font>\n\n"
                       f"**连续失败次数**: <font color=\"comment\">{consecutive}</font>\n\n"
                       f"**错误信息**:\n" + 
                       "\n".join([f">- {err}" for err in errors]) + 
                       f"\n\n**告警时间**: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}"
        }
    }
    
    try:
        response = requests.post(webhook, json=message, timeout=10)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def check_url(url: str, keywords: List[str] = None, timeout: int = 10,
              dingtalk_webhook: str = None, wechat_webhook: str = None) -> Dict[str, Any]:
    result = {
        "url": url,
        "success": False,
        "status_code": None,
        "response_time": None,
        "errors": [],
        "alert_sent": False
    }
    
    start_time = time.time()
    
    try:
        response = requests.get(url, timeout=timeout)
        elapsed = time.time() - start_time
        
        result["status_code"] = response.status_code
        result["response_time"] = round(elapsed * 1000, 2)
        
        HEALTH_CHECK_RESPONSE_TIME.labels(url=url).observe(elapsed)
        
        if response.status_code >= 400:
            result["errors"].append(f"HTTP status code: {response.status_code}")
            HEALTH_CHECK_REQUESTS.labels(url=url, status="error").inc()
        else:
            result["success"] = True
            HEALTH_CHECK_REQUESTS.labels(url=url, status="success").inc()
        
        if keywords:
            for keyword in keywords:
                if keyword not in response.text:
                    result["success"] = False
                    result["errors"].append(f"Keyword not found: '{keyword}'")
    
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - start_time
        result["response_time"] = round(elapsed * 1000, 2)
        result["errors"].append(f"Request failed: {str(e)}")
        HEALTH_CHECK_REQUESTS.labels(url=url, status="error").inc()
    
    HEALTH_CHECK_STATUS.labels(url=url).set(1 if result["success"] else 0)
    HEALTH_CHECK_LAST_TIMESTAMP.labels(url=url).set(time.time())
    
    url_stats = update_failure_count(url, result["success"])
    result["consecutive_failures"] = url_stats["consecutive_failures"]
    
    if not result["success"] and should_send_alert(url_stats):
        alert_sent = False
        
        if dingtalk_webhook:
            if send_dingtalk_alert(dingtalk_webhook, url, result["errors"], url_stats["consecutive_failures"]):
                alert_sent = True
                HEALTH_CHECK_ALERTS_TOTAL.labels(url=url, type="dingtalk").inc()
        
        if wechat_webhook:
            if send_wechat_alert(wechat_webhook, url, result["errors"], url_stats["consecutive_failures"]):
                alert_sent = True
                HEALTH_CHECK_ALERTS_TOTAL.labels(url=url, type="wechat").inc()
        
        if alert_sent:
            update_alert_time(url)
            result["alert_sent"] = True
    
    return result


@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}


@app.route('/health')
def health():
    return json.dumps({"status": "ok", "timestamp": time.time()}), 200, {'Content-Type': 'application/json'}


@app.route('/check')
def run_check_endpoint():
    urls = os.getenv('CHECK_URLS', '').split(',')
    urls = [u.strip() for u in urls if u.strip()]
    
    if not urls:
        return json.dumps({"error": "No URLs configured"}), 400, {'Content-Type': 'application/json'}
    
    keywords = os.getenv('CHECK_KEYWORDS', '').split(',')
    keywords = [k.strip() for k in keywords if k.strip()] or None
    
    timeout = int(os.getenv('CHECK_TIMEOUT', '10'))
    dingtalk_webhook = os.getenv('DINGTALK_WEBHOOK')
    wechat_webhook = os.getenv('WECHAT_WEBHOOK')
    
    results = []
    all_success = True
    
    for url in urls:
        result = check_url(url, keywords, timeout, dingtalk_webhook, wechat_webhook)
        results.append(result)
        if not result["success"]:
            all_success = False
    
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_checks": len(results),
        "successful_checks": sum(1 for r in results if r["success"]),
        "failed_checks": sum(1 for r in results if not r["success"]),
        "results": results
    }
    
    status_code = 200 if all_success else 503
    return json.dumps(report, indent=2, ensure_ascii=False), status_code, {'Content-Type': 'application/json'}


def run_scheduled_checks(interval: int):
    urls = os.getenv('CHECK_URLS', '').split(',')
    urls = [u.strip() for u in urls if u.strip()]
    
    if not urls:
        print("No URLs configured for scheduled checks")
        return
    
    keywords = os.getenv('CHECK_KEYWORDS', '').split(',')
    keywords = [k.strip() for k in keywords if k.strip()] or None
    
    timeout = int(os.getenv('CHECK_TIMEOUT', '10'))
    dingtalk_webhook = os.getenv('DINGTALK_WEBHOOK')
    wechat_webhook = os.getenv('WECHAT_WEBHOOK')
    
    print(f"Scheduled checks started. Interval: {interval}s, URLs: {urls}")
    
    while True:
        try:
            for url in urls:
                check_url(url, keywords, timeout, dingtalk_webhook, wechat_webhook)
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Check completed")
        except Exception as e:
            print(f"Check error: {e}")
        
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="HTTP service health check server with Prometheus metrics")
    parser.add_argument("--port", type=int, default=8080, help="HTTP server port")
    parser.add_argument("--interval", type=int, default=60, help="Check interval in seconds (0 to disable)")
    
    args = parser.parse_args()
    
    if args.interval > 0:
        scheduler_thread = threading.Thread(target=run_scheduled_checks, args=(args.interval,), daemon=True)
        scheduler_thread.start()
    
    print(f"Health check server starting on port {args.port}")
    print(f"Metrics endpoint: http://localhost:{args.port}/metrics")
    print(f"Health endpoint: http://localhost:{args.port}/health")
    print(f"Manual check: http://localhost:{args.port}/check")
    
    app.run(host='0.0.0.0', port=args.port)


if __name__ == "__main__":
    main()
