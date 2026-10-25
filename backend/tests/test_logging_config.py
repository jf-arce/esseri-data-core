import logging

from src.main import app


def test_application_uses_logging_ini_formatter():
    assert app.title == "ESSERI Data Core API"
    logger = logging.getLogger("src")

    assert logger.handlers
    assert logger.handlers[0].formatter._fmt == (
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    )
