#!/usr/bin/env python3
import argparse
import json
import ssl
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional
import urllib.request
import urllib.error


@dataclass
class CheckResult:
    url: str
    success: bool
    status_code: Optional[int]
    response_time: float
    error: Optional[str]
    keyword_found: Optional[bool]


def create_ssl_context():
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def check_url(url: str, keyword: Optional[str] = None, timeout: int = 10) -> CheckResult:
    start_time = time.time()
    result = CheckResult(
        url=url,
        success=False,
        status_code=None,
        response_time=0.0,
        error=None,
        keyword_found=None
    )
    
    ssl_context = create_ssl_context()
    
    try:
        with urllib.request.urlopen(url, timeout=timeout, context=ssl_context) as response:
            elapsed = time.time() - start_time
            result.status_code = response.getcode()
            result.response_time = round(elapsed, 3)
            
            content = response.read().decode('utf-8', errors='ignore')
            
            if keyword:
                result.keyword_found = keyword in content
                result.success = result.keyword_found
            else:
                result.success = 200 <= result.status_code < 300
                
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        result.status_code = e.code
        result.response_time = round(elapsed, 3)
        result.error = f"HTTPError: {e.reason}"
        result.success = False
    except urllib.error.URLError as e:
        elapsed = time.time() - start_time
        result.response_time = round(elapsed, 3)
        result.error = f"URLError: {str(e.reason)}"
        result.success = False
    except Exception as e:
        elapsed = time.time() - start_time
        result.response_time = round(elapsed, 3)
        result.error = f"Exception: {str(e)}"
        result.success = False
    
    return result


def main():
    parser = argparse.ArgumentParser(description='HTTP 服务健康检查工具')
    parser.add_argument('--urls', nargs='+', required=True, help='要检查的 URL 列表')
    parser.add_argument('--keyword', help='响应内容中需要包含的关键字')
    parser.add_argument('--timeout', type=int, default=10, help='超时时间（秒）')
    parser.add_argument('--output', help='输出 JSON 报告的文件路径')
    
    args = parser.parse_args()
    
    results = []
    all_success = True
    
    for url in args.urls:
        result = check_url(url, args.keyword, args.timeout)
        results.append(result)
        if not result.success:
            all_success = False
    
    report = {
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'total_urls': len(results),
        'success_count': sum(1 for r in results if r.success),
        'failure_count': sum(1 for r in results if not r.success),
        'results': [asdict(r) for r in results]
    }
    
    json_output = json.dumps(report, ensure_ascii=False, indent=2)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(json_output)
    else:
        print(json_output)
    
    sys.exit(0 if all_success else 1)


if __name__ == '__main__':
    main()
