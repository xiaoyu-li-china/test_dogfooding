from sqlalchemy import Time, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base
from datetime import time

class QueueRule(Base):
    __tablename__ = "queue_rules"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    max_queue_length: Mapped[int] = mapped_column(Integer, nullable=False)
    
    store: Mapped["Store"] = relationship("Store", back_populates="queue_rules")
    service: Mapped["Service"] = relationship("Service", back_populates="queue_rules")