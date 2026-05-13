from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from transformers import pipeline, AutoTokenizer
from sqlalchemy.orm import Session
from typing import Optional, List
import asyncio
import logging

from config import settings
from database import get_db, init_db
from models import Review, SentimentLabel
from schemas import ReviewCreate, ReviewResponse, ReviewFilter
from tasks import analyze_review_sentiment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="E-commerce Review System with Sentiment Analysis")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "distilbert-base-uncased-finetuned-sst-2-english"
MAX_TOKENS = 512

model = None
tokenizer = None
model_loaded = False
model_load_failed = False


class TextRequest(BaseModel):
    text: str

    @validator('text')
    def check_non_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Text cannot be empty or whitespace only')
        return v


class SentimentResponse(BaseModel):
    label: str
    score: float


def load_model():
    global model, tokenizer, model_loaded, model_load_failed
    if model_loaded:
        return True
    if model_load_failed:
        return False
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = pipeline("sentiment-analysis", model=MODEL_NAME, tokenizer=tokenizer)
        model_loaded = True
        logger.info("Model loaded successfully")
        return True
    except Exception as e:
        model_load_failed = True
        logger.error(f"Failed to load model: {str(e)}")
        return False


def truncate_text(text: str) -> str:
    if tokenizer is None:
        return text
    tokens = tokenizer.encode(text, truncation=False)
    if len(tokens) <= MAX_TOKENS:
        return text
    return tokenizer.decode(tokens[:MAX_TOKENS], skip_special_tokens=True)


async def analyze_sentiment_async(text: str):
    if not load_model():
        raise HTTPException(
            status_code=503,
            detail="Model is currently unavailable. Please try again later."
        )
    
    truncated_text = truncate_text(text)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, model, truncated_text)
    return result[0]


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Database initialized")


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )


@app.get("/")
async def root():
    return {"message": "E-commerce Review System with Sentiment Analysis API"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "database": "connected"
    }


@app.post("/analyze", response_model=SentimentResponse, tags=["Sentiment Analysis"])
async def analyze_sentiment(request: TextRequest):
    try:
        result = await analyze_sentiment_async(request.text)
        return SentimentResponse(
            label=result["label"],
            score=result["score"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during sentiment analysis"
        )


@app.post("/reviews", response_model=ReviewResponse, tags=["Reviews"])
async def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    try:
        db_review = Review(
            user_id=review.user_id,
            product_id=review.product_id,
            content=review.content,
            rating=review.rating,
            sentiment_label=SentimentLabel.PENDING
        )
        db.add(db_review)
        db.commit()
        db.refresh(db_review)
        
        analyze_review_sentiment.delay(db_review.id, db_review.content)
        
        logger.info(f"Created review {db_review.id} and queued sentiment analysis")
        return ReviewResponse(
            id=db_review.id,
            user_id=db_review.user_id,
            product_id=db_review.product_id,
            content=db_review.content,
            rating=db_review.rating,
            sentiment_label=db_review.sentiment_label.value if db_review.sentiment_label else None,
            sentiment_score=db_review.sentiment_score,
            created_at=db_review.created_at,
            updated_at=db_review.updated_at
        )
    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create review: {str(e)}"
        )


@app.get("/reviews", tags=["Reviews"])
async def get_reviews(
    sentiment_label: Optional[SentimentLabel] = Query(None, description="Filter by sentiment label"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Review)
        
        if sentiment_label:
            query = query.filter(Review.sentiment_label == sentiment_label)
        if user_id:
            query = query.filter(Review.user_id == user_id)
        if product_id:
            query = query.filter(Review.product_id == product_id)
        
        total = query.count()
        
        reviews = query.order_by(Review.created_at.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
            "reviews": [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "product_id": r.product_id,
                    "content": r.content,
                    "rating": r.rating,
                    "sentiment_label": r.sentiment_label.value if r.sentiment_label else None,
                    "sentiment_score": r.sentiment_score,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                } for r in reviews
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching reviews: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch reviews: {str(e)}"
        )


@app.get("/reviews/{review_id}", response_model=ReviewResponse, tags=["Reviews"])
async def get_review(review_id: int, db: Session = Depends(get_db)):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        product_id=review.product_id,
        content=review.content,
        rating=review.rating,
        sentiment_label=review.sentiment_label.value if review.sentiment_label else None,
        sentiment_score=review.sentiment_score,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@app.get("/stats/sentiment", tags=["Statistics"])
async def get_sentiment_stats(db: Session = Depends(get_db)):
    try:
        positive_count = db.query(Review).filter(
            Review.sentiment_label == SentimentLabel.POSITIVE
        ).count()
        
        negative_count = db.query(Review).filter(
            Review.sentiment_label == SentimentLabel.NEGATIVE
        ).count()
        
        pending_count = db.query(Review).filter(
            Review.sentiment_label == SentimentLabel.PENDING
        ).count()
        
        failed_count = db.query(Review).filter(
            Review.sentiment_label == SentimentLabel.FAILED
        ).count()
        
        total = positive_count + negative_count + pending_count + failed_count
        
        return {
            "total": total,
            "positive": positive_count,
            "negative": negative_count,
            "pending": pending_count,
            "failed": failed_count,
            "positive_rate": positive_count / total if total > 0 else 0,
            "negative_rate": negative_count / total if total > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error fetching sentiment stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch sentiment statistics: {str(e)}"
        )
