"""Validation tests without weights: python -m unittest backend.test_api."""
import io
import base64
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
import numpy as np
from backend.app import LOCK, _allowed_origins, app, style_model


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        buffer = io.BytesIO()
        Image.new("RGB", (24, 16), "green").save(buffer, format="PNG")
        self.image = buffer.getvalue()

    def post(self, **data):
        return self.client.post("/predict", files={"file": ("test.png", self.image, "image/png")},
                                data={"demo": "detection", **data})

    def test_health(self):
        self.assertEqual(self.client.get("/health").json()["status"], "ok")

    def test_ascii_brightness_and_png(self):
        for color in ("black", "white"):
            buffer = io.BytesIO()
            Image.new("RGB", (80, 40), color).save(buffer, format="PNG")
            self.image = buffer.getvalue()
            response = self.post(demo="ascii", ascii_columns="80")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            lines = data["ascii_text"].split("\n")
            self.assertEqual(len(lines), 24)
            self.assertTrue(all(len(line) == 80 for line in lines))
            if color == "white":
                self.assertTrue(all(line == " " * 80 for line in lines))
            else:
                self.assertTrue(all(line.strip() for line in lines))
            with Image.open(io.BytesIO(base64.b64decode(data["image"].split(",", 1)[1]))) as png:
                self.assertEqual(png.size, (data["width"], data["height"]))
                pixels = np.array(png)
                self.assertGreater(pixels.mean(), 225)
                self.assertGreaterEqual(pixels.min(), 85)
            self.assertIn("elapsed_seconds", data)

    def test_ascii_tonal_order_and_contours(self):
        from backend.app import ascii_art
        gradient = np.tile(np.linspace(0, 255, 320, dtype=np.uint8), (160, 1))
        result = ascii_art(Image.fromarray(gradient), 80)
        pixels = np.array(Image.open(io.BytesIO(base64.b64decode(
            result["image"].split(",", 1)[1]))))
        self.assertLess(pixels[:, :240].mean(), pixels[:, -240:].mean())
        # Equal-average cells should retain a boundary that flat shading lacks.
        flat = Image.new("L", (320, 160), 128)
        striped = np.tile(np.array([0, 0, 255, 255], dtype=np.uint8), (160, 80))
        self.assertNotEqual(ascii_art(flat, 80)["ascii_text"],
                            ascii_art(Image.fromarray(striped), 80)["ascii_text"])

    def test_ascii_limits_and_tall_image(self):
        for columns in (0, 39, 241, "bad"):
            self.assertEqual(self.post(demo="ascii", ascii_columns=columns).status_code, 422)
        buffer = io.BytesIO()
        Image.new("RGB", (1, 1600), "white").save(buffer, format="PNG")
        self.image = buffer.getvalue()
        response = self.post(demo="ascii", ascii_columns=240)
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(response.json()["height"], 4800)

    def test_style_without_torch_loader(self):
        style_model.cache_clear()
        try:
            with patch("backend.app.cv2.dnn.readNetFromTorch", None, create=True):
                response = self.post(demo="style")
            self.assertEqual(response.status_code, 503)
            self.assertIn("start.ps1", response.json()["detail"])
            self.assertFalse(LOCK.locked())
        finally:
            style_model.cache_clear()

    def test_rejects_invalid_inputs(self):
        for data in ({"demo": "unknown"}, {"confidence": "1.1"}, {"style": "../../secret"}):
            self.assertEqual(self.post(**data).status_code, 422)
        self.image = b"not an image"
        self.assertEqual(self.post().status_code, 415)

    def test_oversize_file(self):
        self.image = b"x" * (10 * 1024 * 1024 + 1)
        self.assertEqual(self.post().status_code, 413)

    def test_busy_and_recovery(self):
        with LOCK:
            self.assertEqual(self.post().status_code, 503)
        with patch("backend.app.infer", side_effect=RuntimeError("test failure")):
            self.assertEqual(self.post().status_code, 503)
        self.assertFalse(LOCK.locked())

    def test_dispatch_and_cors(self):
        with patch("backend.app.infer", return_value={"image": "data:image/png;base64,AA=="}) as infer:
            response = self.post(demo="style", style="mosaic")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(infer.call_args.args[1:], ("style", 0.25, 0.6, "mosaic"))
            self.assertIn("elapsed_seconds", response.json())
        response = self.client.options("/predict", headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:5173")

    def test_cors_origins_are_normalized(self):
            self.assertEqual(
                _allowed_origins(" https://example.com/,http://localhost:5173/ "),
                ["https://example.com", "http://localhost:5173"],
            )


if __name__ == "__main__":
    unittest.main()
