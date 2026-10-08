import io
import json
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_test_image(width=400, height=300, color="skyblue") -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    # Draw simple horizon and sun
    draw.rectangle([0, 150, width, height], fill="darkgreen")
    draw.ellipse([100, 50, 160, 110], fill="gold")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    assert data["status"] == "healthy"
    print("[OK] Health endpoint OK:", data)


def test_info():
    res = client.get("/api/info")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert "gemma_model" in data
    print("[OK] Info endpoint OK:", data)


def test_analyze_endpoint():
    img_bytes = create_test_image()
    metrics = {
        "tilt_angle": 1.2,
        "brightness": 140,
        "blur_score": 12.5,
        "is_stable": True,
        "face_detected": False,
    }

    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
    data = {
        "mode": "landscape",
        "metrics": json.dumps(metrics),
    }

    res = client.post("/api/analyze", files=files, data=data)
    assert res.status_code == 200, f"Analyze call failed: {res.text}"
    body = res.json()

    print("[OK] Analyze response received:")
    print("  Tip:", body["tip"])
    print("  Movement:", body["movement"])
    print("  Zoom:", body["suggested_zoom"])
    print("  Exposure hint:", body["exposure_hint"])
    print("  Shot score:", body["shot_score"])
    print("  Provider:", body["provider"])
    print("  Latency ms:", body["latency_ms"])

    assert "tip" in body
    assert "movement" in body
    assert "dx" in body["movement"] and "dy" in body["movement"]
    assert "suggested_zoom" in body
    assert "exposure_hint" in body
    assert "shot_score" in body
    assert 0 <= body["shot_score"] <= 100


def test_max_size_enforcement():
    # Create oversized dummy payload
    oversized = b"0" * (6 * 1024 * 1024)  # 6 MB (limit is 5 MB)
    files = {"file": ("huge.jpg", oversized, "image/jpeg")}
    res = client.post("/api/analyze", files=files, data={"mode": "general"})
    assert res.status_code == 413, f"Expected 413, got {res.status_code}"
    print("[OK] Max upload size enforcement OK: 413 correctly returned")


if __name__ == "__main__":
    print("Running backend tests...")
    test_health()
    test_info()
    test_analyze_endpoint()
    test_max_size_enforcement()
    print("\nAll backend integration tests passed successfully!")
