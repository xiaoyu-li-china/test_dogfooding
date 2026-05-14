#!/usr/bin/env python3
import sys
import json
import time
import argparse
import requests
import os
from typing import List, Dict, Any


FAILURE_COUNT_FILE = "failure_counts.json"
ALERT_THRESHOLD = 3


def load_failure_counts() -> Dict[str, Dict[str, Any]]:
    if os.path.exists(FAILURE_COUNT_FILE):
        try:
            with open(FAILURE_COUNT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_failure_counts(counts: Dict[str, Dict[str, Any]]) -> None:
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


def check_url(url: str, keywords: List[str] = None, timeout: int = 10) -> Dict[str, Any]:
    result = {
        "url": url,
        "success": False,
        "status_code": None,
        "response_time": None,
        "errors": []
    }
    
    start_time = time.time()
    
    try:
        response = requests.get(url, timeout=timeout)
        elapsed = time.time() - start_time
        
        result["status_code"] = response.status_code
        result["response_time"] = round(elapsed * 1000, 2)
        
        if response.status_code >= 400:
            result["errors"].append(f"HTTP status code: {response.status_code}")
        else:
            result["success"] = True
        
        if keywords:
            for keyword in keywords:
                if keyword not in response.text:
                    result["success"] = False
                    result["errors"].append(f"Keyword not found: '{keyword}'")
    
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - start_time
        result["response_time"] = round(elapsed * 1000, 2)
        result["errors"].append(f"Request failed: {str(e)}")
    
    return result


def main():
    parser = argparse.ArgumentParser(description="HTTP service health check with alerts")
    parser.add_argument("--urls", nargs="+", required=True, help="URLs to check")
    parser.add_argument("--keywords", nargs="+", help="Keywords to verify in response")
    parser.add_argument("--timeout", type=int, default=10, help="Request timeout in seconds")
    parser.add_argument("--output", help="Output JSON file path")
    parser.add_argument("--dingtalk-webhook", help="DingTalk webhook URL for alerts")
    parser.add_argument("--wechat-webhook", help="WeChat Work webhook URL for alerts")
    
    args = parser.parse_args()
    
    results = []
    all_success = True
    alerts_sent = []
    
    for url in args.urls:
        result = check_url(url, args.keywords, args.timeout)
        results.append(result)
        
        if not result["success"]:
            all_success = False
        
        url_stats = update_failure_count(url, result["success"])
        result["consecutive_failures"] = url_stats["consecutive_failures"]
        
        if not result["success"] and should_send_alert(url_stats):
            alert_sent = False
            
            if args.dingtalk_webhook:
                if send_dingtalk_alert(args.dingtalk_webhook, url, result["errors"], url_stats["consecutive_failures"]):
                    alert_sent = True
            
            if args.wechat_webhook:
                if send_wechat_alert(args.wechat_webhook, url, result["errors"], url_stats["consecutive_failures"]):
                    alert_sent = True
            
            if alert_sent:
                update_alert_time(url)
                alerts_sent.append(url)
                result["alert_sent"] = True
            else:
                result["alert_sent"] = False
        else:
            result["alert_sent"] = False
    
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_checks": len(results),
        "successful_checks": sum(1 for r in results if r["success"]),
        "failed_checks": sum(1 for r in results if not r["success"]),
        "alerts_sent": alerts_sent,
        "results": results
    }
    
    json_output = json.dumps(report, indent=2, ensure_ascii=False)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_output)
    else:
        print(json_output)
    
    sys.exit(0 if all_success else 1)


if __name__ == "__main__":
    main()
