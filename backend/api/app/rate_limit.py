from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from time import time
from typing import DefaultDict

from fastapi import Request

from app.errors import rate_limit_error


@dataclass
class FixedWindowRateLimiter:
    max_requests: int
    window_seconds: int
    _hits: DefaultDict[str, deque[float]] = field(
        default_factory=lambda: defaultdict(deque)
    )

    def enforce(self, *, scope: str, request: Request) -> None:
        identifier = self._resolve_client_identifier(request)
        key = f"{scope}:{identifier}"
        now = time()
        window = self._hits[key]

        while window and now - window[0] >= self.window_seconds:
            window.popleft()

        if len(window) >= self.max_requests:
            raise rate_limit_error()

        window.append(now)

    @staticmethod
    def _resolve_client_identifier(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        if request.client and request.client.host:
            return request.client.host

        return "unknown"
