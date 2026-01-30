import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
import ssl

client = TestClient(app)


@pytest.mark.parametrize("skip_verify", ["0", "1"])
def test_download_tutorial_ssl_context(skip_verify, monkeypatch):
    """
    Test that the SSL context is correctly configured based on TEMOA_SKIP_CERT_VERIFY.
    This test is parametrized to ensure deterministic behavior.
    """
    monkeypatch.setenv("TEMOA_SKIP_CERT_VERIFY", skip_verify)

    # Patch targets must be on the module that USES the functions
    with patch("backend.main.urllib.request.urlopen") as mock_urlopen, patch(
        "backend.main.shutil.copyfileobj"
    ), patch("backend.main.open", new_callable=MagicMock), patch(
        "backend.main.Path.replace"
    ) as mock_replace, patch("backend.main.Path.unlink"), patch(
        "backend.main.Path.exists", return_value=True
    ):
        # Configure the mock response
        mock_response = MagicMock()
        mock_urlopen.return_value.__enter__.return_value = mock_response

        response = client.post("/api/download_tutorial")

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

        # Verify SSL context and timeout
        _, kwargs = mock_urlopen.call_args
        assert kwargs.get("timeout") == 10
        assert "context" in kwargs
        ctx = kwargs["context"]
        assert isinstance(ctx, ssl.SSLContext)

        if skip_verify == "1":
            assert ctx.check_hostname is False
            assert ctx.verify_mode == ssl.CERT_NONE
        else:
            assert ctx.check_hostname is True
            assert ctx.verify_mode == ssl.CERT_REQUIRED

        # Verify atomic move was attempted
        assert mock_replace.called


def test_download_tutorial_failure():
    # Patch on the actual module to ensure it's intercepted
    with patch(
        "backend.main.urllib.request.urlopen", side_effect=Exception("Network error")
    ):
        response = client.post("/api/download_tutorial")
        assert response.status_code == 500
        assert "Download failed" in response.json()["detail"]
