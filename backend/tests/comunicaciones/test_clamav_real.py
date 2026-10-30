"""Opt-in real scanner proof; never confused with mocked unit-test verdicts."""

import os
from io import BytesIO

import pytest
from PIL import Image

from src.comunicaciones.adjuntos_escaner import escanear
from src.config import settings


@pytest.fixture()
def escaner_real(monkeypatch):
    host = os.environ.get("COMUNICACIONES_CLAMAV_TEST_HOST")
    if not host:
        pytest.skip("Requires an explicitly selected isolated ClamAV scanner")
    monkeypatch.setattr(settings, "CLAMAV_HOST", host)
    monkeypatch.setattr(settings, "CLAMAV_PORT", 13310)
    monkeypatch.setattr(settings, "CLAMAV_TIMEOUT_SEGUNDOS", 30.0)


def test_imagen_limpia_con_clamav_real(escaner_real):
    data = BytesIO()
    Image.new("RGB", (8, 8), "white").save(data, "PNG")
    assert escanear(data.getvalue()) is None


def test_firma_inocua_eicar_detectada_por_clamav_real(escaner_real):
    # Official inert antivirus test signature, not executable malware.
    firma = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    assert escanear(firma)
