from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from db.base import get_db
from models.store import Store
from schemas.store import StoreCreate, StoreResponse

router = APIRouter()

@router.post("/", response_model=StoreResponse)
async def create_store(store: StoreCreate, db: Session = Depends(get_db)):
    new_store = Store(**store.model_dump())
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

@router.get("/", response_model=List[StoreResponse])
async def get_stores(db: Session = Depends(get_db)):
    stmt = select(Store)
    stores = db.execute(stmt).scalars().all()
    return stores

@router.get("/{store_id}", response_model=StoreResponse)
async def get_store(store_id: int, db: Session = Depends(get_db)):
    stmt = select(Store).where(Store.id == store_id)
    store = db.execute(stmt).scalars().first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store