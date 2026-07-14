from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TransactionCategorizationRuleModel


class TransactionCategorizationRuleRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_active_by_user(self, user_id: str) -> list[TransactionCategorizationRuleModel]:
        statement = (
            select(TransactionCategorizationRuleModel)
            .where(
                TransactionCategorizationRuleModel.user_id == user_id,
                TransactionCategorizationRuleModel.is_active.is_(True),
            )
            .order_by(
                TransactionCategorizationRuleModel.priority.desc(),
                TransactionCategorizationRuleModel.usage_count.desc(),
                TransactionCategorizationRuleModel.id.desc(),
            )
        )
        return list(self._session.scalars(statement))

    def get_by_pattern(
        self,
        *,
        user_id: str,
        normalized_pattern: str,
        match_type: str,
    ) -> TransactionCategorizationRuleModel | None:
        statement = select(TransactionCategorizationRuleModel).where(
            TransactionCategorizationRuleModel.user_id == user_id,
            TransactionCategorizationRuleModel.normalized_pattern == normalized_pattern,
            TransactionCategorizationRuleModel.match_type == match_type,
        )
        return self._session.scalar(statement)

    def upsert_rule(
        self,
        *,
        user_id: str,
        normalized_pattern: str,
        match_type: str,
        category_id: int,
        normalized_merchant: str | None,
        priority: int,
        source: str,
        confidence: float,
        commit: bool = True,
    ) -> TransactionCategorizationRuleModel:
        rule = self.get_by_pattern(
            user_id=user_id,
            normalized_pattern=normalized_pattern,
            match_type=match_type,
        )
        if rule is None:
            rule = TransactionCategorizationRuleModel(
                user_id=user_id,
                normalized_pattern=normalized_pattern,
                match_type=match_type,
                category_id=category_id,
                normalized_merchant=normalized_merchant,
                priority=priority,
                source=source,
                usage_count=1,
                confidence=confidence,
                is_active=True,
            )
            self._session.add(rule)
        else:
            rule.category_id = category_id
            rule.normalized_merchant = normalized_merchant
            rule.priority = priority
            rule.source = source
            rule.confidence = confidence
            rule.usage_count += 1
            rule.is_active = True

        if commit:
            self._session.commit()
            self._session.refresh(rule)
        else:
            self._session.flush()
        return rule
