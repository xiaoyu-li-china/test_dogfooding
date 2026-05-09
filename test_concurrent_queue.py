import asyncio
import aiohttp
import json

async def get_queue(session, store_id, service_id):
    url = "http://127.0.0.1:8000/queue/get"
    data = {
        "store_id": store_id,
        "service_id": service_id
    }
    async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=30)) as response:
        return await response.json()

async def test_concurrent_queue():
    # 确保服务已启动
    store_id = 2
    service_id = 2
    
    # 并发请求数量
    concurrent_count = 5
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for _ in range(concurrent_count):
            task = get_queue(session, store_id, service_id)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # 收集所有生成的队列号
        queue_numbers = [result['queue_number'] for result in results]
        print(f"Generated queue numbers: {queue_numbers}")
        
        # 检查是否有重复
        unique_numbers = set(queue_numbers)
        if len(queue_numbers) == len(unique_numbers):
            print("✅ Test passed: No duplicate queue numbers")
            return True
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
            return False

if __name__ == "__main__":
    asyncio.run(test_concurrent_queue())