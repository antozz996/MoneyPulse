from sqlalchemy import select
from sqlalchemy.orm import Session

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
