import threading
import requests
import time

# 存储结果的列表
results = []
lock = threading.Lock()

def get_queue(store_id, service_id):
    url = "http://127.0.0.1:8000/queue/get"
    data = {
        "store_id": store_id,
        "service_id": service_id
    }
    response = requests.post(url, json=data)
    result = response.json()
    with lock:
        results.append(result)

if __name__ == "__main__":
    store_id = 3
    service_id = 3
    concurrent_count = 5
    
    threads = []
    for _ in range(concurrent_count):
        thread = threading.Thread(target=get_queue, args=(store_id, service_id))
        threads.append(thread)
        thread.start()
    
    # 等待所有线程完成
    for thread in threads:
        thread.join()
    
    # 收集所有生成的队列号
    queue_numbers = [result['queue_number'] for result in results]
    print(f"Generated queue numbers: {queue_numbers}")
    
    # 检查是否有重复
    unique_numbers = set(queue_numbers)
    if len(queue_numbers) == len(unique_numbers):
        print("✅ Test passed: No duplicate queue numbers")
    else:
        print("❌ Test failed: Duplicate queue numbers found")
        # 找出重复的号码
        seen = set()
        duplicates = set()
        for num in queue_numbers:
            if num in seen:
                duplicates.add(num)
            seen.add(num)
        print(f"Duplicate numbers: {duplicates}")