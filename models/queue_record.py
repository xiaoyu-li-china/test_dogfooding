from sqlalchemy import String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum
from db.base import Base

class QueueStatus(str, enum.Enum):
    WAITING = "waiting"
    CALLED = "called"
    COMPLETED = "completed"
    MISSED = "missed"

class QueueRecord(Base):
    __tablename__ = "queue_records"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    queue_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    status: Mapped[QueueStatus] = mapped_column(SQLEnum(QueueStatus), default=QueueStatus.WAITING, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    called_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    store: Mapped["Store"] = relationship("Store", back_populates="queue_records")
    service: Mapped["Service"] = relationship("Service", back_populates="queue_records")