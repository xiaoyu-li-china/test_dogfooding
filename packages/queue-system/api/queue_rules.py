from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from db.base import get_db
from models.queue_rule import QueueRule
from schemas.queue_rule import QueueRuleCreate, QueueRuleResponse

router = APIRouter()

@router.post("/", response_model=QueueRuleResponse)
async def create_queue_rule(queue_rule: QueueRuleCreate, db: Session = Depends(get_db)):
    new_queue_rule = QueueRule(**queue_rule.model_dump())
    db.add(new_queue_rule)
    db.commit()
    db.refresh(new_queue_rule)
    return new_queue_rule

@router.get("/", response_model=List[QueueRuleResponse])
async def get_queue_rules(db: Session = Depends(get_db)):
    stmt = select(QueueRule)
    queue_rules = db.execute(stmt).scalars().all()
    return queue_rules

@router.get("/{queue_rule_id}", response_model=QueueRuleResponse)
async def get_queue_rule(queue_rule_id: int, db: Session = Depends(get_db)):
    stmt = select(QueueRule).where(QueueRule.id == queue_rule_id)
    queue_rule = db.execute(stmt).scalars().first()
    if not queue_rule:
        raise HTTPException(status_code=404, detail="Queue rule not found")
    return queue_rule

@router.get("/store/{store_id}", response_model=List[QueueRuleResponse])
async def get_queue_rules_by_store(store_id: int, db: Session = Depends(get_db)):
    stmt = select(QueueRule).where(QueueRule.store_id == store_id)
    queue_rules = db.execute(stmt).scalars().all()
    return queue_rules

@router.get("/service/{service_id}", response_model=List[QueueRuleResponse])
async def get_queue_rules_by_service(service_id: int, db: Session = Depends(get_db)):
    stmt = select(QueueRule).where(QueueRule.service_id == service_id)
    queue_rules = db.execute(stmt).scalars().all()
    return queue_rules
