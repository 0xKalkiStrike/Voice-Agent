from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") in ["READY", "ok"]
    assert "backend" in data
    assert "rocm_available" in data
    assert "reason" in data
