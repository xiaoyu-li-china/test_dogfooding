import os
from typing import Dict, Any

class Config:
    MODEL_NAME: str = os.getenv("MODEL_NAME", "srcnn")
    MAX_CONCURRENT_TASKS: int = int(os.getenv("MAX_CONCURRENT_TASKS", 2))
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "true").lower() == "true"
    CACHE_MAX_SIZE: int = int(os.getenv("CACHE_MAX_SIZE", 100))
    
    MODELS: Dict[str, Dict[str, Any]] = {
        "srcnn": {
            "class": "SRCNN",
            "scale": 4,
            "weights_path": None
        },
        "esrgan": {
            "class": "ESRGAN",
            "scale": 4,
            "weights_path": None
        }
    }
    
    @classmethod
    def get_model_config(cls, model_name: str = None) -> Dict[str, Any]:
        model_name = model_name or cls.MODEL_NAME
        if model_name not in cls.MODELS:
            raise ValueError(f"Model {model_name} not supported. Available: {list(cls.MODELS.keys())}")
        return cls.MODELS[model_name]
