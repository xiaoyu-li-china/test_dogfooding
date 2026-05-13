from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from models import SentimentLabel


class ReviewCreate(BaseModel):
    user_id: int = Field(..., gt=0, description="User ID")
    product_id: int = Field(..., gt=0, description="Product ID")
    content: str = Field(..., min_length=1, max_length=5000, description="Review content")
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating from 1 to 5")

    @validator('content')
    def check_non_empty_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Review content cannot be empty or whitespace only')
        return v.strip()


class ReviewResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    content: str
    rating: Optional[int]
    sentiment_label: Optional[str]
    sentiment_score: Optional[float]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewFilter(BaseModel):
    sentiment_label: Optional[SentimentLabel] = None
    user_id: Optional[int] = None
    product_id: Optional[int] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class SentimentUpdate(BaseModel):
    sentiment_label: SentimentLabel
    sentiment_score: Optional[float] = None
