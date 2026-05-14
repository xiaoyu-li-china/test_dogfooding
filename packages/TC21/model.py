import io
import hashlib
from typing import Optional, Dict, Tuple
from collections import OrderedDict
from PIL import Image
import torch
import torch.nn as nn
from torchvision import transforms
from config import Config


class SRCNN(nn.Module):
    def __init__(self):
        super(SRCNN, self).__init__()
        self.conv1 = nn.Conv2d(3, 64, kernel_size=9, padding=4)
        self.conv2 = nn.Conv2d(64, 32, kernel_size=1, padding=0)
        self.conv3 = nn.Conv2d(32, 3, kernel_size=5, padding=2)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.conv3(x)
        return x


class ESRGAN(nn.Module):
    def __init__(self):
        super(ESRGAN, self).__init__()
        self.conv1 = nn.Conv2d(3, 64, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(64, 3, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)
        self.upsample = nn.Upsample(scale_factor=4, mode='bicubic')

    def forward(self, x):
        x = self.upsample(x)
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.conv3(x)
        return x


class ImageCache:
    def __init__(self, max_size: int = 100):
        self.max_size = max_size
        self.cache: OrderedDict[str, Image.Image] = OrderedDict()

    def _compute_hash(self, image_data: bytes) -> str:
        return hashlib.md5(image_data).hexdigest()

    def get(self, image_data: bytes) -> Optional[Image.Image]:
        img_hash = self._compute_hash(image_data)
        if img_hash in self.cache:
            self.cache.move_to_end(img_hash)
            return self.cache[img_hash]
        return None

    def put(self, image_data: bytes, result: Image.Image) -> None:
        img_hash = self._compute_hash(image_data)
        if img_hash in self.cache:
            self.cache.move_to_end(img_hash)
        else:
            if len(self.cache) >= self.max_size:
                self.cache.popitem(last=False)
            self.cache[img_hash] = result

    def clear(self) -> None:
        self.cache.clear()

    def size(self) -> int:
        return len(self.cache)


class SuperResolutionModel:
    def __init__(self, model_name: str = None):
        self.model_name = model_name or Config.MODEL_NAME
        self.device: torch.device = None
        self.model: nn.Module = None
        self.cache: Optional[ImageCache] = None
        self._initialize()

    def _initialize(self) -> None:
        if Config.CACHE_ENABLED:
            self.cache = ImageCache(max_size=Config.CACHE_MAX_SIZE)

    def _load_model(self) -> None:
        if self.model is not None:
            return

        model_config = Config.get_model_config(self.model_name)
        model_class = model_config["class"]

        if model_class == "SRCNN":
            self.model = SRCNN()
        elif model_class == "ESRGAN":
            self.model = ESRGAN()
        else:
            raise ValueError(f"Model class {model_class} not supported")

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self.model.to(self.device)
        self.model.eval()

        weights_path = model_config.get("weights_path")
        if weights_path:
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))

    def _preprocess(self, image: Image.Image, scale: int) -> torch.Tensor:
        if self.model_name == "srcnn":
            image = image.resize(
                (image.size[0] * scale, image.size[1] * scale),
                Image.BICUBIC
            )
        
        transform = transforms.Compose([transforms.ToTensor()])
        return transform(image).unsqueeze(0).to(self.device)

    def _postprocess(self, tensor: torch.Tensor) -> Image.Image:
        tensor = tensor.squeeze(0).clamp(0, 1)
        transform = transforms.ToPILImage()
        return transform(tensor.cpu())

    def _image_to_bytes(self, image: Image.Image) -> bytes:
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format="PNG")
        return img_byte_arr.getvalue()

    def enhance(self, image: Image.Image, scale: int = 4, use_cache: bool = True) -> Tuple[Image.Image, bool]:
        self._load_model()

        if use_cache and self.cache is not None:
            image_bytes = self._image_to_bytes(image)
            cached_result = self.cache.get(image_bytes)
            if cached_result is not None:
                return cached_result, True

        img_tensor = self._preprocess(image, scale)

        with torch.no_grad():
            output = self.model(img_tensor)

        result_image = self._postprocess(output)

        if use_cache and self.cache is not None:
            image_bytes = self._image_to_bytes(image)
            self.cache.put(image_bytes, result_image)

        return result_image, False

    def clear_cache(self) -> None:
        if self.cache is not None:
            self.cache.clear()

    def cache_size(self) -> int:
        return self.cache.size() if self.cache is not None else 0

    def is_loaded(self) -> bool:
        return self.model is not None
