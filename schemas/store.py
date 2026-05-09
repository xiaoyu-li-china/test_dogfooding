from pydantic import BaseModel

class StoreCreate(BaseModel):
    name: str
    address: str
    phone: str

class StoreResponse(BaseModel):
    id: int
    name: str
    address: str
    phone: str
    
    class Config:
        from_attributes = True