from __future__ import annotations

from uuid import uuid4

from app.config import Settings
from app.errors import ApiError, authentication_error
from app.models import UserModel
from app.repositories.users import UserRepository
from app.schemas.auth import AuthSessionRead, LoginCreate, RegisterUserCreate, UserRead
from app.security import create_access_token, verify_password, hash_password


class AuthService:
    def __init__(self, repository: UserRepository, settings: Settings) -> None:
        self._repository = repository
        self._settings = settings

    def register(self, payload: RegisterUserCreate) -> AuthSessionRead:
        user = self._repository.create_user(
            user_id=str(uuid4()),
            name=payload.name,
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
        return self._build_session(user)

    def login(self, payload: LoginCreate) -> AuthSessionRead:
        user = self._repository.get_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise authentication_error("Invalid email or password.")

        return self._build_session(user)

    def get_user(self, user_id: str) -> UserModel:
        try:
            return self._repository.get_by_id(user_id)
        except ApiError as exc:
            if exc.code == "not_found":
                raise authentication_error("Authenticated user account was not found.") from exc
            raise

    def _build_session(self, user: UserModel) -> AuthSessionRead:
        if user.email is None:
            raise authentication_error("This account cannot authenticate.")

        access_token, expires_in_seconds = create_access_token(
            subject=user.id,
            email=user.email,
            secret_key=self._settings.auth_secret_key,
            expires_in_minutes=self._settings.auth_access_token_ttl_minutes,
        )
        return AuthSessionRead(
            access_token=access_token,
            token_type="bearer",
            expires_in_seconds=expires_in_seconds,
            user=UserRead.model_validate(user, from_attributes=True),
        )
