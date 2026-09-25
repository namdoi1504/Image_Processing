"""Run actual models through the API, including downloaded DeepLab weights.

Run explicitly from root: python -m backend.smoke_models
Writes only under backend/smoke-results (ignored by git).
"""
import base64
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import ROOT, app


def main():
    client = TestClient(app)
    output = ROOT / "backend" / "smoke-results"
    output.mkdir(exist_ok=True)
    for demo, filename in (
        ("detection", "teefarm-zebras-5015976_1920.jpg"),
        ("style", "monalisa.jpg"),
        ("segmentation", "maxmann-cycling-races-3637140_1920.jpg"),
    ):
        with (ROOT / "images" / filename).open("rb") as image:
            response = client.post("/predict", files={"file": (filename, image, "image/jpeg")},
                                   data={"demo": demo, "style": "starry_night"})
        if response.status_code != 200:
            raise RuntimeError(f"{demo}: {response.status_code} {response.text}")
        result = response.json()
        (output / f"{demo}.png").write_bytes(base64.b64decode(result["image"].split(",", 1)[1]))
        print(f"{demo}: OK {result['width']}x{result['height']} {result['elapsed_seconds']}s", flush=True)


if __name__ == "__main__":
    main()
