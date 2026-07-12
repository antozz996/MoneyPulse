from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import UserFinancialProfileModel


class UserFinancialProfileRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_user(self, user_id: str) -> UserFinancialProfileModel | None:
        statement = select(UserFinancialProfileModel).where(
            UserFinancialProfileModel.user_id == user_id
        )
        return self._session.scalar(statement)

    def get_or_create_default(
        self,
        *,
        user_id: str,
        currency: str,
        locale: str = "en",
    ) -> UserFinancialProfileModel:
        existing = self.get_by_user(user_id)
        if existing is not None:
            return existing

        profile = UserFinancialProfileModel(
            user_id=user_id,
            currency=currency,
            locale=locale,
            salary_day=None,
            protected_balance=0,
            risk_profile="BALANCED",
            default_cycle_mode="CALENDAR_MONTH",
            status="active",
        )
        self._session.add(profile)
        self._session.commit()
        self._session.refresh(profile)
        return profile

    def update(
        self,
        profile: UserFinancialProfileModel,
        *,
        currency: str,
        locale: str,
        salary_day: int | None,
        protected_balance: float,
        risk_profile: str,
        default_cycle_mode: str,
        status: str = "active",
    ) -> UserFinancialProfileModel:
        profile.currency = currency
        profile.locale = locale
        profile.salary_day = salary_day
        profile.protected_balance = protected_balance
        profile.risk_profile = risk_profile
        profile.default_cycle_mode = default_cycle_mode
        profile.status = status
        profile.updated_at = datetime.now(UTC)
        self._session.commit()
        self._session.refresh(profile)
        return profile
