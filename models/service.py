from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

class Service(Base):
    __tablename__ = "services"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    
    store: Mapped["Store"] = relationship("Store", back_populates="services")
    queue_rules: Mapped["QueueRule"] = relationship("QueueRule", back_populates="service")
    queue_records: Mapped["QueueRecord"] = relationship("QueueRecord", back_populates="service")