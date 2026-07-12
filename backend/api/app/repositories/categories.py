from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import CategoryModel


class CategoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[CategoryModel]:
        statement = (
            select(CategoryModel)
            .where(
                CategoryModel.user_id == user_id,
                CategoryModel.status != "archived",
            )
            .order_by(CategoryModel.is_system.desc(), CategoryModel.name.asc(), CategoryModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def create_many(self, categories: list[CategoryModel]) -> None:
        if not categories:
            return
        self._session.add_all(categories)
        self._session.commit()

    def get_for_user(self, user_id: str, category_id: int) -> CategoryModel:
        statement = select(CategoryModel).where(
            CategoryModel.user_id == user_id,
            CategoryModel.id == category_id,
            CategoryModel.status != "archived",
        )
        category = self._session.scalar(statement)
        if category is None:
            raise not_found_error("category", category_id)
        return category

    def ensure_defaults(self, user_id: str) -> list[CategoryModel]:
        existing = self.list_by_user(user_id)
        existing_keys = {category.key for category in existing}
        now = datetime.now(UTC)
        defaults = [
            ("salary", "Salary", "income", "salary", "green"),
            ("housing", "Housing", "expense", "home", "slate"),
            ("groceries", "Groceries", "expense", "cart", "emerald"),
            ("utilities", "Utilities", "expense", "bolt", "amber"),
            ("transport", "Transport", "expense", "car", "blue"),
            ("health", "Health", "expense", "heart", "red"),
            ("fun", "Fun", "expense", "sparkles", "pink"),
            ("savings", "Savings", "expense", "piggy-bank", "violet"),
        ]
        missing = [
            CategoryModel(
                user_id=user_id,
                key=key,
                name=name,
                entry_type=entry_type,
                icon_key=icon_key,
                color_key=color_key,
                is_system=True,
                status="active",
                created_at=now,
                updated_at=now,
            )
            for key, name, entry_type, icon_key, color_key in defaults
            if key not in existing_keys
        ]
        self.create_many(missing)
        return self.list_by_user(user_id)
