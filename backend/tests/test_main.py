from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_solvers():
    response = client.get("/api/solvers")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    # Even if no solvers are found, it should return defaults
    assert len(response.json()) >= 2


def test_list_files():
    response = client.get("/api/files?path=.")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    # Check if we see backend folder
    names = [item["name"] for item in response.json()]
    assert "backend" in names or "main.py" in names


def test_results_not_found():
    response = client.get("/api/results/nonexistent_run")
    assert response.status_code == 404
