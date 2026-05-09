from fastapi import APIRouter
from .health import router as health_router
from .store import router as store_router
from .service import router as service_router
from .queue_rules import router as queue_rules_router
from .queue import router as queue_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(store_router, prefix="/stores", tags=["stores"])
api_router.include_router(service_router, prefix="/services", tags=["services"])
api_router.include_router(queue_rules_router, prefix="/queue-rules", tags=["queue-rules"])
api_router.include_router(queue_router, prefix="/queue", tags=["queue"])