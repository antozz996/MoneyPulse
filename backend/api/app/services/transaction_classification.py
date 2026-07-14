ESSENTIAL_CATEGORY_KEYS = {"housing", "groceries", "utilities", "transport", "health"}


def derive_internal_transaction_category(
    transaction_type: str,
    *,
    legacy_category: str | None = None,
    category_key: str | None = None,
) -> str | None:
    if legacy_category is not None:
        return legacy_category

    if transaction_type != "expense":
        return None

    if category_key is None:
        return "committed"

    return "essential" if category_key in ESSENTIAL_CATEGORY_KEYS else "committed"
