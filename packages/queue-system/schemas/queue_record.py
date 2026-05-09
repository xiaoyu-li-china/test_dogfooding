from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from models.queue_record import QueueStatus

class QueueRecordCreate(BaseModel):
    store_id: int
    service_id: int

class QueueRecordResponse(BaseModel):
    id: int
    store_id: int
    service_id: int
    queue_number: str
    status: QueueStatus
    created_at: datetime
    called_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class QueueStatusUpdate(BaseModel):
    status: QueueStatus