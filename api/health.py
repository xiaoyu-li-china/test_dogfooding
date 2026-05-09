from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.base import get_db
from sqlalchemy import select

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        stmt = select(1)
        db.execute(stmt)
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "version": "1.0.0"
        }