"""Vision Lab API. Start from repository root: uvicorn backend.app:app."""
import base64
import io
import logging
import os
import threading
import time
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision.models.segmentation import (
    DeepLabV3_ResNet101_Weights,
    deeplabv3_resnet101,
)
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
STYLES = {name: ROOT / "models" / "instance_norm" / f"{name}.t7" for name in (
    "starry_night", "feathers", "candy", "mosaic", "udnie", "the_scream", "la_muse"
)}
Image.MAX_IMAGE_PIXELS = 25_000_000
LOCK = threading.Lock()
app = FastAPI(title="Vision Lab API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@lru_cache(maxsize=1)
def detection_model():
    # Ultralytics downloads the standard weights if the local file is absent.
    return YOLO(str(ROOT / "yolo26n.pt"))


@lru_cache(maxsize=1)
def segmentation_model():
    weights = DeepLabV3_ResNet101_Weights.DEFAULT
    return deeplabv3_resnet101(weights=weights).eval(), weights


@lru_cache(maxsize=2)
def style_model(name):
    path = STYLES[name]
    if not path.is_file():
        raise HTTPException(503, f"Thiếu mô hình phong cách: {name}.t7")
    return cv2.dnn.readNetFromTorch(str(path))


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": {
        "detection": detection_model.cache_info().currsize > 0,
        "segmentation": segmentation_model.cache_info().currsize > 0,
        "style": style_model.cache_info().currsize > 0,
    }}


def infer(image, demo, confidence, opacity, style):
    """Serialize access: OpenCV DNN and shared models have mutable state."""
    items = []
    if demo == "detection":
        prediction = detection_model().predict(image, conf=confidence, verbose=False)[0]
        output = Image.fromarray(cv2.cvtColor(prediction.plot(), cv2.COLOR_BGR2RGB))
        items = [{"label": prediction.names[int(box.cls.item())],
                  "value": f"{box.conf.item():.0%}"} for box in prediction.boxes]
        model_name = "YOLO26n"
    elif demo == "segmentation":
        model, weights = segmentation_model()
        # Bound CPU/RAM cost while retaining the input aspect ratio.
        image.thumbnail((900, 900))
        inp = weights.transforms()(image).unsqueeze(0)
        with torch.inference_mode():
            mask = model(inp)["out"].argmax(1)[0].byte().cpu().numpy()
        mask = np.array(Image.fromarray(mask).resize(image.size, Image.Resampling.NEAREST))
        palette = np.array([
            [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
            [0, 0, 128], [128, 0, 128], [0, 128, 128], [128, 128, 128],
            [64, 0, 0], [192, 0, 0], [64, 128, 0], [192, 128, 0],
            [64, 0, 128], [192, 0, 128], [64, 128, 128], [192, 128, 128],
            [0, 64, 0], [128, 64, 0], [0, 192, 0], [128, 192, 0], [0, 64, 128],
        ], dtype=np.uint8)
        output = Image.blend(image, Image.fromarray(palette[mask]), opacity)
        categories = weights.meta["categories"]
        items = [{"label": categories[int(label)], "value": f"{np.mean(mask == label):.1%}"}
                 for label in np.unique(mask)]
        model_name = "DeepLabV3 · ResNet101"
    else:
        image.thumbnail((800, 800))
        bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        height, width = bgr.shape[:2]
        mean = (103.939, 116.779, 123.680)
        net = style_model(style)
        net.setInput(cv2.dnn.blobFromImage(bgr, 1.0, (width, height), mean, swapRB=False))
        output_array = net.forward()[0].transpose(1, 2, 0) + np.array(mean)
        output_array = np.clip(output_array, 0, 255).astype(np.uint8)
        output = Image.fromarray(cv2.cvtColor(output_array, cv2.COLOR_BGR2RGB)).resize(image.size)
        model_name = f"Neural Style Transfer · {style}"
    buffer = io.BytesIO()
    output.save(buffer, format="PNG")
    return {"image": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode(),
            "model": model_name, "width": output.width, "height": output.height, "items": items}


@app.post("/predict")
def predict(
    file: Annotated[UploadFile, File()],
    demo: Annotated[Literal["detection", "segmentation", "style"], Form()],
    confidence: Annotated[float, Form(ge=0.05, le=1)] = 0.25,
    opacity: Annotated[float, Form(ge=0, le=1)] = 0.6,
    style: Annotated[str, Form()] = "starry_night",
):
    if style not in STYLES:
        raise HTTPException(422, "Phong cách không hợp lệ.")
    try:
        raw = file.file.read(10 * 1024 * 1024 + 1)
    finally:
        file.file.close()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "Ảnh vượt quá giới hạn 10 MB.")
    try:
        with Image.open(io.BytesIO(raw)) as original:
            if original.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(415, "Chỉ hỗ trợ ảnh JPG, PNG và WEBP.")
            if original.width * original.height > 25_000_000:
                raise HTTPException(413, "Ảnh vượt quá 25 triệu điểm ảnh.")
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((1600, 1600))
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(413, "Kích thước ảnh quá lớn.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(415, "Không đọc được ảnh. Hãy tải một tệp ảnh hợp lệ.")
    if not LOCK.acquire(blocking=False):
        raise HTTPException(503, "Máy chủ đang xử lý một ảnh khác. Vui lòng thử lại sau.")
    try:
        start = time.perf_counter()
        result = infer(image, demo, confidence, opacity, style)
        result["elapsed_seconds"] = round(time.perf_counter() - start, 3)
        return result
    except HTTPException:
        raise
    except Exception:
        logging.exception("Model inference failed")
        raise HTTPException(503, "Không chạy được mô hình. Kiểm tra model và log trên máy chủ.")
    finally:
        LOCK.release()
