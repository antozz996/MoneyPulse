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
            onboarding_status="not_started",
            onboarding_step="basics",
            onboarding_completed_at=None,
            setup_quality_score=0,
            missing_setup_fields=None,
            protected_balance_configured=False,
            zero_balance_declared=False,
            cycle_configured=False,
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
        profile.protected_balance_configured = True
        profile.cycle_configured = True
        if profile.onboarding_status == "not_started":
            profile.onboarding_status = "in_progress"
        if not profile.onboarding_step:
            profile.onboarding_step = "basics"
        profile.status = status
        profile.updated_at = datetime.now(UTC)
        self._session.commit()
        self._session.refresh(profile)
        return profile

    def save(self, profile: UserFinancialProfileModel) -> UserFinancialProfileModel:
        profile.updated_at = datetime.now(UTC)
        self._session.add(profile)
        self._session.commit()
        self._session.refresh(profile)
        return profile
