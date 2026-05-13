import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestNormalRequests:
    @pytest.mark.asyncio
    async def test_positive_sentiment(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "POSITIVE", "score": 0.95}]
        
        response = client.post(
            "/analyze",
            json={"text": "I love this wonderful day!"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "label" in data
        assert "score" in data
        assert data["label"] in ["POSITIVE", "NEGATIVE"]
        assert 0 <= data["score"] <= 1
    
    @pytest.mark.asyncio
    async def test_negative_sentiment(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "NEGATIVE", "score": 0.85}]
        
        response = client.post(
            "/analyze",
            json={"text": "This is the worst experience ever."}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["label"] == "NEGATIVE"
        assert data["score"] == 0.85
    
    @pytest.mark.asyncio
    async def test_response_structure(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "POSITIVE", "score": 0.90}]
        
        response = client.post(
            "/analyze",
            json={"text": "Testing the API"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert set(data.keys()) == {"label", "score"}
        assert isinstance(data["label"], str)
        assert isinstance(data["score"], float)


class TestEmptyTextRequests:
    @pytest.mark.asyncio
    async def test_empty_string(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        response = client.post(
            "/analyze",
            json={"text": ""}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_whitespace_only(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        response = client.post(
            "/analyze",
            json={"text": "   "}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_missing_text_field(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        response = client.post(
            "/analyze",
            json={}
        )
        
        assert response.status_code == 422


class TestLongTextRequests:
    @pytest.mark.asyncio
    async def test_long_text_truncation(self, mock_long_text_tokenizer):
        mock_tokenizer, mock_pipeline = mock_long_text_tokenizer
        from main import app
        client = TestClient(app)
        
        long_text = "word " * 1000
        
        response = client.post(
            "/analyze",
            json={"text": long_text}
        )
        
        assert response.status_code == 200
        
        mock_pipeline.assert_called_once()
        call_args = mock_pipeline.call_args
        processed_text = call_args[0][0]
        assert processed_text == "truncated text"
    
    @pytest.mark.asyncio
    async def test_normal_length_text_not_truncated(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "POSITIVE", "score": 0.95}]
        
        response = client.post(
            "/analyze",
            json={"text": "This is a short text."}
        )
        
        assert response.status_code == 200


class TestModelFailureDegradation:
    @pytest.mark.asyncio
    async def test_model_load_failure_returns_503(self, mock_model_failure):
        from main import app
        client = TestClient(app)
        
        response = client.post(
            "/analyze",
            json={"text": "This should fail gracefully"}
        )
        
        assert response.status_code == 503
    
    @pytest.mark.asyncio
    async def test_model_load_failure_error_message(self, mock_model_failure):
        from main import app
        client = TestClient(app)
        
        response = client.post(
            "/analyze",
            json={"text": "Test"}
        )
        
        data = response.json()
        assert "detail" in data
        assert "unavailable" in data["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_model_failure_does_not_crash(self, mock_model_failure):
        from main import app
        client = TestClient(app)
        
        try:
            response = client.post(
                "/analyze",
                json={"text": "Test"}
            )
            assert response.status_code in [503, 500]
        except Exception as e:
            pytest.fail(f"API crashed instead of returning error: {e}")


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_special_characters(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "POSITIVE", "score": 0.75}]
        
        response = client.post(
            "/analyze",
            json={"text": "Hello! 👋 This is @awesome #cool & fun! 🎉"}
        )
        
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_multiple_requests(self, mock_model_success):
        from main import app
        client = TestClient(app)
        
        mock_model_success.return_value = [{"label": "POSITIVE", "score": 0.90}]
        
        for i in range(3):
            response = client.post(
                "/analyze",
                json={"text": f"Request {i}"}
            )
            assert response.status_code == 200
