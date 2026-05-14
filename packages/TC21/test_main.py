import io
import time
import tempfile
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def create_test_image(width: int = 100, height: int = 100) -> bytes:
    img = Image.new("RGB", (width, height), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    return img_byte_arr.getvalue()

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "endpoints" in data
    assert "/upscale" in data["endpoints"]

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"

def test_upscale_image_dimensions():
    original_width, original_height = 50, 50
    test_image = create_test_image(original_width, original_height)
    
    response = client.post(
        "/upscale",
        files={"file": ("test.png", test_image, "image/png")},
        data={"scale": 4}
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    
    result_image = Image.open(io.BytesIO(response.content))
    assert result_image.width == original_width * 4
    assert result_image.height == original_height * 4

def test_upscale_scale_2():
    original_width, original_height = 100, 80
    test_image = create_test_image(original_width, original_height)
    
    response = client.post(
        "/upscale",
        files={"file": ("test.png", test_image, "image/png")},
        data={"scale": 2}
    )
    
    assert response.status_code == 200
    
    result_image = Image.open(io.BytesIO(response.content))
    assert result_image.width == original_width * 2
    assert result_image.height == original_height * 2

def test_upscale_invalid_file():
    response = client.post(
        "/upscale",
        files={"file": ("test.txt", b"not an image", "text/plain")}
    )
    assert response.status_code == 400

def test_upscale_invalid_scale():
    test_image = create_test_image(50, 50)
    response = client.post(
        "/upscale",
        files={"file": ("test.png", test_image, "image/png")},
        data={"scale": 3}
    )
    assert response.status_code == 400

def test_upscale_processing_time():
    original_width, original_height = 100, 100
    test_image = create_test_image(original_width, original_height)
    
    start_time = time.time()
    response = client.post(
        "/upscale",
        files={"file": ("test.png", test_image, "image/png")},
        data={"scale": 4}
    )
    elapsed_time = time.time() - start_time
    
    assert response.status_code == 200
    assert elapsed_time < 30, f"Processing took too long: {elapsed_time:.2f}s"

def test_upscale_with_tempfile():
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img = Image.new("RGB", (80, 60), color="blue")
        img.save(tmp, format="PNG")
        tmp_path = tmp.name
    
    try:
        with open(tmp_path, "rb") as f:
            response = client.post(
                "/upscale",
                files={"file": ("test.png", f, "image/png")},
                data={"scale": 4}
            )
        
        assert response.status_code == 200
        
        result_image = Image.open(io.BytesIO(response.content))
        assert result_image.width == 80 * 4
        assert result_image.height == 60 * 4
    finally:
        import os
        os.unlink(tmp_path)

def test_concurrent_requests():
    import concurrent.futures
    
    test_image = create_test_image(50, 50)
    
    def make_request():
        return client.post(
            "/upscale",
            files={"file": ("test.png", test_image, "image/png")},
            data={"scale": 4}
        )
    
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(make_request) for _ in range(4)]
        results = [f.result() for f in futures]
    elapsed_time = time.time() - start_time
    
    for response in results:
        assert response.status_code == 200
        result_image = Image.open(io.BytesIO(response.content))
        assert result_image.width == 50 * 4
        assert result_image.height == 50 * 4
    
    assert elapsed_time < 60, f"Concurrent processing took too long: {elapsed_time:.2f}s"

def test_model_lazy_loading():
    import main
    
    assert main.model is None, "Model should not be loaded initially"
    
    test_image = create_test_image(50, 50)
    response = client.post(
        "/upscale",
        files={"file": ("test.png", test_image, "image/png")}
    )
    
    assert response.status_code == 200
    assert main.model is not None, "Model should be loaded after first request"
    assert main.model.training is False, "Model should be in eval mode"
