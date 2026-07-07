from __future__ import annotations

import json
import logging
from typing import Any


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(message)s",
        force=True,
    )


def log_structured(logger: logging.Logger, **fields: Any) -> None:
    logger.info(json.dumps(fields, default=str, sort_keys=True))
