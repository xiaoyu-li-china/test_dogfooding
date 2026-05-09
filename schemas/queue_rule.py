from pydantic import BaseModel
from datetime import time

class QueueRuleCreate(BaseModel):
    store_id: int
    service_id: int
    start_time: time
    end_time: time
    max_queue_length: int

class QueueRuleResponse(BaseModel):
    id: int
    store_id: int
    service_id: int
    start_time: time
    end_time: time
    max_queue_length: int
    
    class Config:
        from_attributes = True