from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import json
import secrets
from typing import Any

from app.errors import authentication_error

PBKDF2_ITERATIONS = 100_000
JWT_ALGORITHM = "HS256"


@dataclass(frozen=True)
class AccessTokenClaims:
    sub: str
    email: str
    exp: int


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}$"
        f"{derived_key.hex()}"
    )


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        scheme, iteration_text, salt, expected_hash = password_hash.split("$", 3)
        digest_length = len(bytes.fromhex(expected_hash))
    except ValueError:
        return False

    if scheme != "pbkdf2_sha256":
        return False

    try:
        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iteration_text),
            digest_length,
        )
    except ValueError:
        return False

    return hmac.compare_digest(derived_key.hex(), expected_hash)


def create_access_token(
    *,
    subject: str,
    email: str,
    secret_key: str,
    expires_in_minutes: int,
) -> tuple[str, int]:
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
    payload = AccessTokenClaims(
        sub=subject,
        email=email,
        exp=int(expires_at.timestamp()),
    )
    token = _encode_jwt(payload, secret_key)
    return token, int(timedelta(minutes=expires_in_minutes).total_seconds())


def decode_access_token(token: str, secret_key: str) -> AccessTokenClaims:
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
    except ValueError as exc:
        raise authentication_error("Invalid access token.") from exc

    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    expected_signature = _sign(signing_input, secret_key)

    if not hmac.compare_digest(expected_signature, signature_segment):
        raise authentication_error("Invalid access token.")

    try:
        payload = json.loads(_base64url_decode(payload_segment))
        claims = AccessTokenClaims(
            sub=str(payload["sub"]),
            email=str(payload["email"]),
            exp=int(payload["exp"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise authentication_error("Invalid access token.") from exc

    if claims.exp < int(datetime.now(UTC).timestamp()):
        raise authentication_error("Access token has expired.")

    return claims


def _encode_jwt(payload: AccessTokenClaims, secret_key: str) -> str:
    header_segment = _base64url_encode(
        json.dumps({"alg": JWT_ALGORITHM, "typ": "JWT"}, separators=(",", ":")).encode(
            "utf-8"
        )
    )
    payload_segment = _base64url_encode(
        json.dumps(payload.__dict__, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature_segment = _sign(signing_input, secret_key)
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def _sign(value: bytes, secret_key: str) -> str:
    signature = hmac.new(
        secret_key.encode("utf-8"),
        value,
        hashlib.sha256,
    ).digest()
    return _base64url_encode(signature)


def _base64url_encode(value: bytes) -> str:
    return urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))
