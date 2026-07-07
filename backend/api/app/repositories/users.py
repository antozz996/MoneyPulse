from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.errors import conflict_error, not_found_error
from app.models import UserModel


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_or_create_demo_user(
        self,
        *,
        demo_user_id: str,
        demo_user_name: str,
    ) -> UserModel:
        existing = self._session.scalar(
            select(UserModel).where(UserModel.id == demo_user_id)
        )
        if existing is not None:
            return existing

        user = UserModel(id=demo_user_id, name=demo_user_name)
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return user

    def get_by_id(self, user_id: str) -> UserModel:
        user = self._session.scalar(select(UserModel).where(UserModel.id == user_id))
        if user is None:
            raise not_found_error("user", user_id)
        return user

    def get_by_email(self, email: str) -> UserModel | None:
        normalized_email = email.strip().lower()
        return self._session.scalar(
            select(UserModel).where(UserModel.email == normalized_email)
        )

    def create_user(
        self,
        *,
        user_id: str,
        name: str,
        email: str,
        password_hash: str,
    ) -> UserModel:
        existing = self.get_by_email(email)
        if existing is not None:
            raise conflict_error(
                "An account already exists for this email address.",
                {"field": "email"},
            )

        user = UserModel(
            id=user_id,
            name=name,
            email=email.strip().lower(),
            password_hash=password_hash,
        )
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return user

    def delete_user(self, user_id: str) -> None:
        self._session.execute(delete(UserModel).where(UserModel.id == user_id))
        self._session.commit()
