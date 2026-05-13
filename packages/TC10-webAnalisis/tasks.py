import httpx
import logging
from celery_app import celery_app
from config import settings
from database import SessionLocal
from models import Review, SentimentLabel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_review_sentiment(self, review_id: int, review_content: str):
    """
    Celery task to analyze review sentiment asynchronously.
    """
    db = SessionLocal()
    try:
        review = db.query(Review).filter(Review.id == review_id).first()
        if not review:
            logger.error(f"Review with id {review_id} not found")
            return

        logger.info(f"Analyzing sentiment for review {review_id}")

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                settings.SENTIMENT_API_URL,
                json={"text": review_content},
            )

            if response.status_code == 200:
                result = response.json()
                sentiment_label = result.get("label")
                sentiment_score = result.get("score")

                if sentiment_label in ["POSITIVE", "NEGATIVE"]:
                    review.sentiment_label = SentimentLabel(sentiment_label)
                    review.sentiment_score = sentiment_score
                    db.commit()
                    logger.info(f"Successfully analyzed review {review_id}: {sentiment_label} ({sentiment_score})")
                    return {
                        "review_id": review_id,
                        "sentiment_label": sentiment_label,
                        "sentiment_score": sentiment_score,
                    }
                else:
                    raise ValueError(f"Invalid sentiment label: {sentiment_label}")
            else:
                raise Exception(f"Sentiment API returned status code {response.status_code}")

    except httpx.RequestError as e:
        logger.error(f"Network error when calling sentiment API: {e}")
        review.sentiment_label = SentimentLabel.FAILED
        db.commit()
        raise self.retry(exc=e)
    except Exception as e:
        logger.error(f"Error analyzing sentiment for review {review_id}: {e}")
        if review:
            review.sentiment_label = SentimentLabel.FAILED
            db.commit()
        raise self.retry(exc=e)
    finally:
        db.close()
