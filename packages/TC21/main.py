import io
import asyncio
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
from config import Config
from model import SuperResolutionModel

app = FastAPI(title="Image Super-Resolution API", version="2.0")

MAX_CONCURRENT_TASKS = Config.MAX_CONCURRENT_TASKS
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)

sr_model = SuperResolutionModel()


@app.post("/upscale", response_class=StreamingResponse)
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = 4,
    use_cache: bool = True
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    if scale not in [2, 4]:
        raise HTTPException(status_code=400, detail="Scale must be 2 or 4")
    
    async with semaphore:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert("RGB")
            
            loop = asyncio.get_event_loop()
            result_image, from_cache = await loop.run_in_executor(
                None,
                sr_model.enhance,
                image,
                scale,
                use_cache
            )
            
            img_byte_arr = io.BytesIO()
            result_image.save(img_byte_arr, format="PNG")
            img_byte_arr.seek(0)
            
            headers = {
                "Content-Disposition": f"attachment; filename=upscaled_{file.filename}",
                "X-Cache-Hit": str(from_cache).lower()
            }
            
            return StreamingResponse(
                img_byte_arr,
                media_type="image/png",
                headers=headers
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.get("/cache/status")
async def cache_status():
    return {
        "enabled": Config.CACHE_ENABLED,
        "max_size": Config.CACHE_MAX_SIZE,
        "current_size": sr_model.cache_size()
    }


@app.get("/cache/clear")
async def clear_cache():
    sr_model.clear_cache()
    return {"message": "Cache cleared successfully"}


@app.get("/model/info")
async def model_info():
    return {
        "model_name": sr_model.model_name,
        "is_loaded": sr_model.is_loaded(),
        "device": str(sr_model.device) if sr_model.is_loaded() else None
    }


@app.get("/")
async def root():
    return {
        "message": "Image Super-Resolution API v2.0",
        "features": [
            "Multiple model support (SRCNN, ESRGAN)",
            "MD5 image caching to avoid duplicate computation",
            "Concurrent request limiting",
            "Lazy model loading"
        ],
        "endpoints": {
            "/upscale": "POST - Upload image for super-resolution",
            "/cache/status": "GET - Get cache status",
            "/cache/clear": "GET - Clear cache",
            "/model/info": "GET - Get model information",
            "/health": "GET - Health check",
            "/docs": "Swagger UI documentation"
        }
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": sr_model.is_loaded(),
        "cache_enabled": Config.CACHE_ENABLED,
        "cache_size": sr_model.cache_size()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
