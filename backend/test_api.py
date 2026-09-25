"""Validation tests without weights: python -m unittest backend.test_api."""
import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from backend.app import LOCK, app


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


if __name__ == "__main__":
    unittest.main()
