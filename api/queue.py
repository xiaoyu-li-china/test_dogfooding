from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.base import get_db
from services.queue_service import QueueService
from schemas.queue_record import QueueRecordCreate, QueueRecordResponse

router = APIRouter()

@router.post("/get", response_model=QueueRecordResponse)
async def get_queue(queue: QueueRecordCreate, db: Session = Depends(get_db)):
    new_queue = QueueService.get_queue(db, queue.store_id, queue.service_id)
    return new_queue

@router.post("/call", response_model=QueueRecordResponse)
async def call_next_queue(store_id: int, service_id: int, db: Session = Depends(get_db)):
    next_queue = QueueService.call_next_queue(db, store_id, service_id)
    if not next_queue:
        raise HTTPException(status_code=404, detail="No waiting queue found")
    return next_queue

@router.post("/miss/{queue_id}", response_model=QueueRecordResponse)
async def mark_missed(queue_id: int, db: Session = Depends(get_db)):
    queue = QueueService.mark_missed(db, queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    return queue

@router.post("/complete/{queue_id}", response_model=QueueRecordResponse)
async def complete_queue(queue_id: int, db: Session = Depends(get_db)):
    queue = QueueService.complete_queue(db, queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    return queue

@router.get("/length/today")
async def get_today_queue_length(store_id: int, service_id: int, db: Session = Depends(get_db)):
    length = QueueService.get_today_queue_length(db, store_id, service_id)
    return {"length": length}

@router.get("/length/waiting")
async def get_waiting_queue_length(store_id: int, service_id: int, db: Session = Depends(get_db)):
    length = QueueService.get_waiting_queue_length(db, store_id, service_id)
    return {"length": length}