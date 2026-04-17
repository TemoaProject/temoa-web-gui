import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from temoa_runner import app

client = TestClient(app)


def create_exists_mock(success_after=0):
    calls = [0]

    def exists_mock(*args, **kwargs):
        calls[0] += 1
        if calls[0] > success_after:
            return True
        return False

    return exists_mock


@pytest.mark.parametrize("skip_verify", ["0", "1"])
def test_download_tutorial_legacy_fallback(skip_verify, monkeypatch):
    monkeypatch.setenv("TEMOA_SKIP_CERT_VERIFY", skip_verify)

    with patch("temoa_runner.subprocess.run", side_effect=Exception("CLI fail")), patch(
        "temoa_runner.urllib.request.urlopen"
    ) as mock_urlopen, patch("temoa_runner.shutil.copyfileobj"), patch(
        "temoa_runner.open", new_callable=MagicMock
    ), patch("temoa_runner.Path.replace"), patch("temoa_runner.Path.unlink"), patch(
        "temoa_runner.Path.exists", side_effect=create_exists_mock(success_after=1)
    ), patch("temoa_runner.start_datasette"):
        mock_response = MagicMock()
        mock_urlopen.return_value.__enter__.return_value = mock_response

        response = client.post("/api/download_tutorial")
        assert response.status_code == 200
        assert "path" in response.json()


def test_download_tutorial_cli_success():
    with patch("temoa_runner.subprocess.run") as mock_run, patch(
        "temoa_runner.Path.exists", side_effect=create_exists_mock(success_after=1)
    ), patch("temoa_runner.start_datasette"):
        response = client.post("/api/download_tutorial")

        assert response.status_code == 200
        assert mock_run.called


def test_download_tutorial_total_failure():
    with patch("temoa_runner.subprocess.run", side_effect=Exception("CLI fail")), patch(
        "temoa_runner.urllib.request.urlopen", side_effect=Exception("Network error")
    ), patch("temoa_runner.Path.exists", return_value=False), patch(
        "temoa_runner.start_datasette"
    ):
        response = client.post("/api/download_tutorial")
        assert response.status_code == 500
        assert "Failed to download tutorial assets" in response.json()["detail"]
