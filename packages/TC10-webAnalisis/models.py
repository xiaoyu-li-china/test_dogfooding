from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class SentimentLabel(str, enum.Enum):
    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    PENDING = "PENDING"
    FAILED = "FAILED"


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    content = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)
    sentiment_label = Column(Enum(SentimentLabel), default=SentimentLabel.PENDING)
    sentiment_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "content": self.content,
            "rating": self.rating,
            "sentiment_label": self.sentiment_label.value if self.sentiment_label else None,
            "sentiment_score": self.sentiment_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
