from dataclasses import dataclass
import re
from typing import Literal
import unicodedata

from sqlalchemy.orm import Session

from app.errors import validation_error
from app.models import CategoryModel, TransactionModel
from app.repositories.categories import CategoryRepository
from app.repositories.transaction_categorization_rules import (
    TransactionCategorizationRuleRepository,
)
from app.repositories.transactions import TransactionRepository
from app.schemas.transaction_categorization import (
    CategorizationMatchSource,
    TransactionCategorizationInputRow,
)


MatchType = Literal["exact", "contains", "prefix"]

_NOISE_TOKENS = {
    "acquisto",
    "addebito",
    "atm",
    "bancomat",
    "bonifico",
    "carta",
    "card",
    "credito",
    "debit",
    "debito",
    "instantaneo",
    "mktp",
    "pagamento",
    "payment",
    "pos",
    "sepa",
}

_GENERIC_LOCATION_TOKENS = {"it", "ita", "italia"}

_KNOWN_MERCHANT_ALIASES: tuple[tuple[str, str, str], ...] = (
    ("netflix", "Netflix", "subscriptions"),
    ("spotify", "Spotify", "subscriptions"),
    ("amazon", "Amazon", "shopping"),
    ("amzn", "Amazon", "shopping"),
    ("esso", "Esso", "fuel"),
    ("eni", "Eni", "fuel"),
    ("q8", "Q8", "fuel"),
    ("vodafone", "Vodafone", "utilities"),
    ("tim", "TIM", "utilities"),
    ("windtre", "WindTre", "utilities"),
    ("uber", "Uber", "transport"),
    ("just eat", "Just Eat", "restaurants"),
    ("deliveroo", "Deliveroo", "restaurants"),
    ("glovo", "Glovo", "restaurants"),
)

_SYSTEM_RULES: tuple[tuple[str | None, str | None, tuple[str, ...], str], ...] = (
    ("income", "salary", ("salary", "stipendio", "payroll", "wage"), "Looks like salary or payroll income."),
    ("expense", "groceries", ("supermercato", "grocery", "groceries", "esselunga", "coop", "conad", "lidl"), "Looks like grocery spending."),
    ("expense", "restaurants", ("restaurant", "ristorante", "pizzeria", "bar", "deliveroo", "just eat", "glovo"), "Looks like food or restaurant spending."),
    ("expense", "fuel", ("fuel", "carburante", "benzina", "diesel", "esso", "eni", "q8"), "Looks like fuel spending."),
    ("expense", "utilities", ("utility", "utilities", "bolletta", "enel", "vodafone", "tim", "windtre", "gas", "water", "internet"), "Looks like a utility or telecom payment."),
    ("expense", "subscriptions", ("subscription", "abbonamento", "netflix", "spotify", "prime video"), "Looks like a recurring subscription."),
    ("expense", "transport", ("transport", "train", "treno", "metro", "bus", "taxi", "uber", "autostrada"), "Looks like transport spending."),
    ("expense", "shopping", ("amazon", "amzn", "shopping", "store", "negozio"), "Looks like general shopping."),
    (None, None, ("transfer", "giroconto", "bonifico interno"), "Looks like a transfer rather than regular spending."),
    ("expense", "cash_withdrawal", ("prelievo", "cash withdrawal", "atm cash"), "Looks like a cash withdrawal."),
    ("expense", "health", ("farmacia", "pharmacy", "doctor", "medico", "clinic", "dentist"), "Looks like healthcare spending."),
)


def normalize_lookup_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    compact = re.sub(r"[^a-zA-Z0-9]+", " ", ascii_value).strip().lower()
    return " ".join(compact.split())


def normalize_transaction_description(value: str | None) -> str:
    return normalize_lookup_text(value)


def normalize_merchant_name(value: str | None) -> str | None:
    normalized = normalize_lookup_text(value)
    if not normalized:
        return None

    for needle, label, _ in _KNOWN_MERCHANT_ALIASES:
        if needle in normalized:
            return label

    tokens = [
        token
        for token in normalized.split()
        if not token.isdigit()
        and token not in _NOISE_TOKENS
        and token not in _GENERIC_LOCATION_TOKENS
    ]
    if not tokens:
        return None

    return " ".join(tokens[:3]).title()


@dataclass(frozen=True)
class CategorizationSuggestion:
    suggested_category_id: int | None
    normalized_merchant: str | None
    confidence: float
    matched_rule_source: CategorizationMatchSource
    explanation: str
    needs_review: bool
    warnings: tuple[str, ...] = ()


class TransactionCategorizationService:
    def __init__(self, session: Session) -> None:
        self._categories = CategoryRepository(session)
        self._rules = TransactionCategorizationRuleRepository(session)
        self._transactions = TransactionRepository(session)

    def suggest_for_row(
        self,
        user_id: str,
        row: TransactionCategorizationInputRow,
    ) -> CategorizationSuggestion:
        categories = self._categories.ensure_defaults(user_id)
        category_by_key = {category.key: category for category in categories}
        category_by_id = {category.id: category for category in categories}
        normalized_description = normalize_transaction_description(row.description)
        normalized_merchant = normalize_merchant_name(row.merchant or row.description)
        normalized_merchant_lookup = normalize_lookup_text(normalized_merchant)
        normalized_source_text = " ".join(
            part
            for part in (normalized_merchant_lookup, normalized_description)
            if part
        ).strip()
        warnings: list[str] = []

        if row.category_id is not None:
            explicit_category = category_by_id.get(row.category_id)
            if explicit_category is None:
                raise validation_error(
                    "category_id was not found for the current user.",
                    {"field": "category_id", "value": row.category_id},
                )
            return CategorizationSuggestion(
                suggested_category_id=row.category_id,
                normalized_merchant=normalized_merchant,
                confidence=1,
                matched_rule_source="explicit",
                explanation="Using the category you selected.",
                needs_review=False,
            )

        exact_rule = self._match_user_rule(
            user_id=user_id,
            text_candidates=tuple(
                value
                for value in (
                    normalized_merchant_lookup,
                    normalized_description,
                    normalized_source_text,
                )
                if value
            ),
            match_types=("exact",),
        )
        if exact_rule is not None:
            suggestion = self._build_learned_rule_suggestion(
                rule=exact_rule,
                category_by_id=category_by_id,
                transaction_type=row.type,
                normalized_merchant=normalized_merchant,
                match_source="user_rule_exact",
                minimum_confidence=0.85,
                maximum_confidence=0.99,
                explanation="Recognized from your previous correction.",
            )
            if suggestion is not None:
                return suggestion

        partial_rule = self._match_user_rule(
            user_id=user_id,
            text_candidates=tuple(
                value
                for value in (
                    normalized_merchant_lookup,
                    normalized_description,
                    normalized_source_text,
                )
                if value
            ),
            match_types=("contains", "prefix"),
        )
        if partial_rule is not None:
            suggestion = self._build_learned_rule_suggestion(
                rule=partial_rule,
                category_by_id=category_by_id,
                transaction_type=row.type,
                normalized_merchant=normalized_merchant,
                match_source="user_rule_partial",
                minimum_confidence=0.74,
                maximum_confidence=0.9,
                explanation="Matched a rule learned from your past categorizations.",
            )
            if suggestion is not None:
                return suggestion

        merchant_alias_match = self._match_known_merchant_alias(
            category_by_key=category_by_key,
            normalized_text=normalized_source_text,
            transaction_type=row.type,
        )
        if merchant_alias_match is not None:
            return merchant_alias_match

        system_match = self._match_system_rule(
            category_by_key=category_by_key,
            normalized_text=normalized_source_text,
            transaction_type=row.type,
        )
        if system_match is not None:
            return system_match

        history_match = self._match_history(
            user_id=user_id,
            normalized_merchant_lookup=normalized_merchant_lookup,
            normalized_description=normalized_description,
            transaction_type=row.type,
        )
        if history_match is not None:
            return CategorizationSuggestion(
                suggested_category_id=history_match.category_id,
                normalized_merchant=normalize_merchant_name(
                    history_match.merchant or history_match.name
                )
                or normalized_merchant,
                confidence=0.76,
                matched_rule_source="history",
                explanation="Matched a similar transaction you categorized before.",
                needs_review=False,
            )

        if not row.merchant:
            warnings.append("Merchant is missing, so this suggestion is less certain.")

        return CategorizationSuggestion(
            suggested_category_id=None,
            normalized_merchant=normalized_merchant,
            confidence=0.22,
            matched_rule_source="fallback",
            explanation="Not enough signal to suggest a reliable category yet.",
            needs_review=True,
            warnings=tuple(warnings),
        )

    def learn_user_correction(
        self,
        *,
        user_id: str,
        category_id: int,
        description: str,
        merchant: str | None,
        source: str,
        apply_to_similar: bool,
        commit: bool = True,
    ) -> None:
        if not apply_to_similar:
            return

        normalized_merchant = normalize_merchant_name(merchant or description)
        normalized_description = normalize_transaction_description(description)
        pattern = normalize_lookup_text(normalized_merchant) if normalized_merchant else normalized_description
        if not pattern:
            return

        match_type: MatchType = "exact"
        if len(pattern.split()) >= 3:
            match_type = "contains"

        self._rules.upsert_rule(
            user_id=user_id,
            normalized_pattern=pattern,
            match_type=match_type,
            category_id=category_id,
            normalized_merchant=normalized_merchant,
            priority=300 if source == "user_correction" else 240,
            source=source,
            confidence=0.93 if source == "user_correction" else 0.88,
            commit=commit,
        )

    def _build_learned_rule_suggestion(
        self,
        *,
        rule,
        category_by_id: dict[int, CategoryModel],
        transaction_type: str,
        normalized_merchant: str | None,
        match_source: CategorizationMatchSource,
        minimum_confidence: float,
        maximum_confidence: float,
        explanation: str,
    ) -> CategorizationSuggestion | None:
        matched_category = category_by_id.get(rule.category_id)
        if matched_category is None or matched_category.entry_type != transaction_type:
            return None

        return CategorizationSuggestion(
            suggested_category_id=rule.category_id,
            normalized_merchant=rule.normalized_merchant or normalized_merchant,
            confidence=min(max(rule.confidence, minimum_confidence), maximum_confidence),
            matched_rule_source=match_source,
            explanation=explanation,
            needs_review=False,
        )

    def _match_user_rule(
        self,
        *,
        user_id: str,
        text_candidates: tuple[str, ...],
        match_types: tuple[MatchType, ...],
    ):
        for rule in self._rules.list_active_by_user(user_id):
            if rule.match_type not in match_types:
                continue
            for candidate in text_candidates:
                if self._candidate_matches_rule(candidate, rule.normalized_pattern, rule.match_type):
                    return rule
        return None

    def _match_known_merchant_alias(
        self,
        *,
        category_by_key: dict[str, CategoryModel],
        normalized_text: str,
        transaction_type: str,
    ) -> CategorizationSuggestion | None:
        for needle, merchant_label, category_key in _KNOWN_MERCHANT_ALIASES:
            if needle not in normalized_text:
                continue
            category = category_by_key.get(category_key)
            if category is None or category.entry_type != transaction_type:
                continue
            return CategorizationSuggestion(
                suggested_category_id=category.id,
                normalized_merchant=merchant_label,
                confidence=0.91,
                matched_rule_source="merchant_alias",
                explanation=f"Recognized the merchant as {merchant_label}.",
                needs_review=False,
            )
        return None

    def _match_history(
        self,
        *,
        user_id: str,
        normalized_merchant_lookup: str,
        normalized_description: str,
        transaction_type: str,
    ) -> TransactionModel | None:
        if not normalized_merchant_lookup and not normalized_description:
            return None

        for transaction in self._transactions.list_categorized_for_user(user_id):
            if transaction.direction != transaction_type:
                continue
            merchant_lookup = normalize_lookup_text(
                normalize_merchant_name(transaction.merchant or transaction.name)
            )
            description_lookup = normalize_transaction_description(transaction.name)
            if normalized_merchant_lookup and normalized_merchant_lookup == merchant_lookup:
                return transaction
            if normalized_description and normalized_description == description_lookup:
                return transaction
        return None

    def _match_system_rule(
        self,
        *,
        category_by_key: dict[str, CategoryModel],
        normalized_text: str,
        transaction_type: str,
    ) -> CategorizationSuggestion | None:
        for allowed_type, category_key, patterns, explanation in _SYSTEM_RULES:
            if allowed_type is not None and allowed_type != transaction_type:
                continue
            if not any(pattern in normalized_text for pattern in patterns):
                continue
            category = category_by_key.get(category_key) if category_key else None
            return CategorizationSuggestion(
                suggested_category_id=category.id if category is not None else None,
                normalized_merchant=normalize_merchant_name(normalized_text),
                confidence=0.68 if category is not None else 0.52,
                matched_rule_source="system_rule",
                explanation=explanation,
                needs_review=category is None,
            )
        return None

    def _candidate_matches_rule(
        self,
        candidate: str,
        pattern: str,
        match_type: MatchType,
    ) -> bool:
        if not candidate or not pattern:
            return False
        if match_type == "exact":
            return candidate == pattern
        if match_type == "prefix":
            return candidate.startswith(pattern)
        return pattern in candidate
