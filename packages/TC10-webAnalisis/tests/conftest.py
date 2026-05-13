import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_model_success():
    mock_pipeline = MagicMock()
    mock_pipeline.return_value = [{"label": "POSITIVE", "score": 0.95}]
    
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [101, 102]
    mock_tokenizer.decode.return_value = "truncated text"
    
    with patch('main.pipeline', return_value=mock_pipeline), \
         patch('main.AutoTokenizer.from_pretrained', return_value=mock_tokenizer):
        import main
        main.model = None
        main.tokenizer = None
        main.model_loaded = False
        main.model_load_failed = False
        yield mock_pipeline

@pytest.fixture
def mock_model_failure():
    with patch('main.pipeline', side_effect=Exception("Model download failed")), \
         patch('main.AutoTokenizer.from_pretrained', side_effect=Exception("Tokenizer download failed")):
        import main
        main.model = None
        main.tokenizer = None
        main.model_loaded = False
        main.model_load_failed = False
        yield

@pytest.fixture
def mock_long_text_tokenizer():
    mock_pipeline = MagicMock()
    mock_pipeline.return_value = [{"label": "POSITIVE", "score": 0.99}]
    
    mock_tokenizer = MagicMock()
    long_tokens = [i for i in range(1000)]
    mock_tokenizer.encode.return_value = long_tokens
    mock_tokenizer.decode.return_value = "truncated text"
    
    with patch('main.pipeline', return_value=mock_pipeline), \
         patch('main.AutoTokenizer.from_pretrained', return_value=mock_tokenizer):
        import main
        main.model = None
        main.tokenizer = None
        main.model_loaded = False
        main.model_load_failed = False
        yield mock_tokenizer, mock_pipeline
