from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from db.base import get_db
from models.service import Service
from schemas.service import ServiceCreate, ServiceResponse

router = APIRouter()

@router.post("/", response_model=ServiceResponse)
async def create_service(service: ServiceCreate, db: Session = Depends(get_db)):
    new_service = Service(**service.model_dump())
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service

@router.get("/", response_model=List[ServiceResponse])
async def get_services(db: Session = Depends(get_db)):
    stmt = select(Service)
    services = db.execute(stmt).scalars().all()
    return services

@router.get("/store/{store_id}", response_model=List[ServiceResponse])
async def get_services_by_store(store_id: int, db: Session = Depends(get_db)):
    stmt = select(Service).where(Service.store_id == store_id)
    services = db.execute(stmt).scalars().all()
    return services