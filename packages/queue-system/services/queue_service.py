from sqlalchemy.orm import Session
from sqlalchemy import select, func
from models.queue_record import QueueRecord, QueueStatus
from models.store import Store
from models.service import Service
from models.queue_rule import QueueRule
from datetime import datetime, date
import time as time_module
from typing import Optional

class QueueService:
    @staticmethod
    def generate_queue_number(db: Session, store_id: int, service_id: int) -> str:
        today = date.today()
        prefix = f"{today.strftime('%Y%m%d')}-{store_id}-{service_id}-"
        
        stmt = select(QueueRecord).where(
            QueueRecord.store_id == store_id,
            QueueRecord.service_id == service_id,
            QueueRecord.created_at >= datetime.combine(today, datetime.min.time()),
            QueueRecord.created_at <= datetime.combine(today, datetime.max.time())
        ).order_by(QueueRecord.id.desc())
        
        last_record = db.execute(stmt).scalars().first()
        
        if last_record:
            last_number = int(last_record.queue_number.split('-')[-1])
            new_number = last_number + 1
        else:
            new_number = 1
        
        return f"{prefix}{new_number:04d}"
    
    @staticmethod
    def get_queue(db: Session, store_id: int, service_id: int) -> QueueRecord:
        max_retries = 10
        for _ in range(max_retries):
            queue_number = QueueService.generate_queue_number(db, store_id, service_id)
            
            new_queue = QueueRecord(
                store_id=store_id,
                service_id=service_id,
                queue_number=queue_number,
                status=QueueStatus.WAITING
            )
            
            try:
                db.add(new_queue)
                db.commit()
                db.refresh(new_queue)
                return new_queue
            except Exception:
                db.rollback()
                time_module.sleep(0.1)
                continue
        
        raise Exception("Failed to create queue record after multiple attempts")
    
    @staticmethod
    def call_next_queue(db: Session, store_id: int, service_id: int) -> Optional[QueueRecord]:
        stmt = select(QueueRecord).where(
            QueueRecord.store_id == store_id,
            QueueRecord.service_id == service_id,
            QueueRecord.status == QueueStatus.WAITING
        ).order_by(QueueRecord.created_at)
        
        next_queue = db.execute(stmt).scalars().first()
        
        if next_queue:
            next_queue.status = QueueStatus.CALLED
            next_queue.called_at = datetime.utcnow()
            db.commit()
            db.refresh(next_queue)
        
        return next_queue
    
    @staticmethod
    def mark_missed(db: Session, queue_id: int) -> Optional[QueueRecord]:
        stmt = select(QueueRecord).where(QueueRecord.id == queue_id)
        queue = db.execute(stmt).scalars().first()
        
        if queue:
            queue.status = QueueStatus.MISSED
            db.commit()
            db.refresh(queue)
        
        return queue
    
    @staticmethod
    def complete_queue(db: Session, queue_id: int) -> Optional[QueueRecord]:
        stmt = select(QueueRecord).where(QueueRecord.id == queue_id)
        queue = db.execute(stmt).scalars().first()
        
        if queue:
            queue.status = QueueStatus.COMPLETED
            queue.completed_at = datetime.utcnow()
            db.commit()
            db.refresh(queue)
        
        return queue
    
    @staticmethod
    def get_today_queue_length(db: Session, store_id: int, service_id: int) -> int:
        today = date.today()
        stmt = select(func.count()).select_from(QueueRecord).where(
            QueueRecord.store_id == store_id,
            QueueRecord.service_id == service_id,
            QueueRecord.created_at >= datetime.combine(today, datetime.min.time()),
            QueueRecord.created_at <= datetime.combine(today, datetime.max.time())
        )
        
        count = db.execute(stmt).scalar()
        return count or 0
    
    @staticmethod
    def get_waiting_queue_length(db: Session, store_id: int, service_id: int) -> int:
        stmt = select(func.count()).select_from(QueueRecord).where(
            QueueRecord.store_id == store_id,
            QueueRecord.service_id == service_id,
            QueueRecord.status == QueueStatus.WAITING
        )
        
        count = db.execute(stmt).scalar()
        return count or 0