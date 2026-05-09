from pydantic import BaseModel
from typing import Optional

class ServiceCreate(BaseModel):
    store_id: int
    name: str
    description: Optional[str] = None

class ServiceResponse(BaseModel):
    id: int
    store_id: int
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True