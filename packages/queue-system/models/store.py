from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

class Store(Base):
    __tablename__ = "stores"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    
    services = relationship("Service", back_populates="store")
    queue_rules = relationship("QueueRule", back_populates="store")
    queue_records = relationship("QueueRecord", back_populates="store")