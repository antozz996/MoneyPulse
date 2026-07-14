from datetime import date

import pytest

from app.services.transaction_categorization import normalize_merchant_name


def get_category_id(categories: list[dict[str, object]], key: str) -> int:
    return next(category["id"] for category in categories if category["key"] == key)


def get_category_key(categories: list[dict[str, object]], category_id: int | None) -> str | None:
    if category_id is None:
        return None
    return next(
        category["key"]
        for category in categories
        if category["id"] == category_id
    )


def test_normalize_merchant_examples_are_deterministic() -> None:
    assert normalize_merchant_name("PAYPAL *NETFLIX.COM") == "Netflix"
    assert normalize_merchant_name("POS ESSO NAPOLI 1234") == "Esso"
    assert normalize_merchant_name("AMZN MKTP IT") == "Amazon"
    assert normalize_merchant_name("ADDEBITO SEPA VODAFONE") == "Vodafone"


@pytest.mark.anyio
async def test_categorize_uses_merchant_alias_then_fallback(
    client,
    register_user,
) -> None:
    auth = await register_user()

    categories_response = await client.get("/categories", headers=auth["headers"])
    categories = categories_response.json()

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "ADDEBITO SEPA VODAFONE",
                    "type": "expense",
                    "date": date.today().isoformat(),
                },
                {
                    "description": "UNMAPPED ARTISAN PAYMENT",
                    "type": "expense",
                    "date": date.today().isoformat(),
                },
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"]
    assert get_category_key(categories, payload[0]["suggested_category_id"]) == "utilities"
    assert payload[0]["matched_rule_source"] == "merchant_alias"
    assert payload[0]["normalized_merchant"] == "Vodafone"
    assert payload[1]["suggested_category_id"] is None
    assert payload[1]["needs_review"] is True
    assert payload[1]["matched_rule_source"] == "fallback"


@pytest.mark.anyio
async def test_explicit_category_wins_over_other_matches(client, register_user) -> None:
    auth = await register_user()
    categories_response = await client.get("/categories", headers=auth["headers"])
    groceries_id = get_category_id(categories_response.json(), "groceries")

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "PAYPAL *NETFLIX.COM",
                    "type": "expense",
                    "category_id": groceries_id,
                }
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"][0]
    assert payload["suggested_category_id"] == groceries_id
    assert payload["matched_rule_source"] == "explicit"


@pytest.mark.anyio
async def test_exact_user_rule_wins_over_known_merchant_alias(client, register_user) -> None:
    auth = await register_user()
    categories_response = await client.get("/categories", headers=auth["headers"])
    categories = categories_response.json()
    groceries_id = get_category_id(categories, "groceries")

    create_response = await client.post(
        "/transactions",
        json={
            "amount": 12,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "PAYPAL *NETFLIX.COM",
        },
        headers=auth["headers"],
    )
    assert create_response.status_code == 201

    feedback_response = await client.post(
        f"/transactions/{create_response.json()['id']}/categorization-feedback",
        json={
            "confirmed_category_id": groceries_id,
            "confirmed_merchant": "Netflix",
            "apply_to_similar": True,
        },
        headers=auth["headers"],
    )
    assert feedback_response.status_code == 200

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "PAYPAL *NETFLIX.COM",
                    "type": "expense",
                }
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"][0]
    assert payload["suggested_category_id"] == groceries_id
    assert payload["matched_rule_source"] == "user_rule_exact"


@pytest.mark.anyio
async def test_partial_user_rule_wins_over_known_merchant_alias(client, register_user) -> None:
    auth = await register_user(email="categorization-partial@example.com")
    categories_response = await client.get("/categories", headers=auth["headers"])
    categories = categories_response.json()
    groceries_id = get_category_id(categories, "groceries")

    create_response = await client.post(
        "/transactions",
        json={
            "amount": 12,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Monthly home fiber bill",
        },
        headers=auth["headers"],
    )
    assert create_response.status_code == 201

    feedback_response = await client.post(
        f"/transactions/{create_response.json()['id']}/categorization-feedback",
        json={
            "confirmed_category_id": groceries_id,
            "confirmed_merchant": "Monthly Home Fiber",
            "apply_to_similar": True,
        },
        headers=auth["headers"],
    )
    assert feedback_response.status_code == 200

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "ADDEBITO SEPA VODAFONE MONTHLY HOME FIBER",
                    "type": "expense",
                }
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"][0]
    assert payload["suggested_category_id"] == groceries_id
    assert payload["matched_rule_source"] == "user_rule_partial"


@pytest.mark.anyio
async def test_historical_correction_is_reused_without_rule(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    categories_response = await client.get("/categories", headers=auth["headers"])
    categories = categories_response.json()
    groceries_id = get_category_id(categories, "groceries")

    create_response = await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "category_id": groceries_id,
            "amount": 35,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Local Market",
            "merchant": "Local Market",
        },
        headers=auth["headers"],
    )
    assert create_response.status_code == 201

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "Local Market",
                    "merchant": "Local Market",
                    "type": "expense",
                }
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"][0]
    assert payload["suggested_category_id"] == groceries_id
    assert payload["matched_rule_source"] == "history"


@pytest.mark.anyio
async def test_system_rule_wins_before_historical_match(client, register_user) -> None:
    auth = await register_user(email="categorization-system@example.com")
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    categories_response = await client.get("/categories", headers=auth["headers"])
    categories = categories_response.json()
    groceries_id = get_category_id(categories, "groceries")
    restaurants_id = get_category_id(categories, "restaurants")
    create_response = await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "category_id": groceries_id,
            "amount": 25,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Restaurant",
            "merchant": "Local Place",
        },
        headers=auth["headers"],
    )
    assert create_response.status_code == 201

    response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "Restaurant",
                    "type": "expense",
                }
            ]
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()["items"][0]
    assert payload["suggested_category_id"] == restaurants_id
    assert payload["matched_rule_source"] == "system_rule"


@pytest.mark.anyio
async def test_corrections_are_isolated_per_user(client, register_user) -> None:
    first_user = await register_user(email="categorization-owner@example.com")
    second_user = await register_user(email="categorization-other@example.com")

    first_categories = (await client.get("/categories", headers=first_user["headers"])).json()
    groceries_id = get_category_id(first_categories, "groceries")

    first_transaction = await client.post(
        "/transactions",
        json={
            "amount": 18,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "My Corner Shop",
        },
        headers=first_user["headers"],
    )
    await client.post(
        f"/transactions/{first_transaction.json()['id']}/categorization-feedback",
        json={
          "confirmed_category_id": groceries_id,
          "confirmed_merchant": "My Corner Shop",
          "apply_to_similar": True
        },
        headers=first_user["headers"],
    )

    second_response = await client.post(
        "/transactions/categorize",
        json={
            "items": [
                {
                    "description": "My Corner Shop",
                    "merchant": "My Corner Shop",
                    "type": "expense",
                }
            ]
        },
        headers=second_user["headers"],
    )

    assert second_response.status_code == 200
    payload = second_response.json()["items"][0]
    assert payload["matched_rule_source"] != "user_rule_exact"


@pytest.mark.anyio
async def test_csv_preview_includes_categorization_suggestion(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )

    response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": "RGF0ZSxEZXNjcmlwdGlvbixBbW91bnQKMjAyNi0wNy0xMixBRERFQklUTyBTRVBBIFZPREFGT05FLC0zNS4wMAo=",
            "account_id": account_response.json()["id"],
            "currency": "EUR",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    row = response.json()["rows"][0]
    assert row["normalized_merchant"] == "Vodafone"
    assert row["suggested_category_id"] is not None
    assert row["explanation"]


@pytest.mark.anyio
async def test_recategorization_dry_run_does_not_persist(client, register_user) -> None:
    auth = await register_user()
    transaction_response = await client.post(
        "/transactions",
        json={
            "amount": 16,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Uber trip",
        },
        headers=auth["headers"],
    )
    transaction_id = transaction_response.json()["id"]

    recategorize_response = await client.post(
        "/transactions/recategorize",
        json={"commit": False, "limit": 10},
        headers=auth["headers"],
    )
    transactions_response = await client.get("/transactions", headers=auth["headers"])

    assert recategorize_response.status_code == 200
    assert recategorize_response.json()["updated_count"] == 0
    item = next(
        item
        for item in recategorize_response.json()["items"]
        if item["transaction_id"] == transaction_id
    )
    assert item["suggested_category_id"] is not None
    persisted = next(
        item for item in transactions_response.json()["items"] if item["id"] == transaction_id
    )
    assert persisted["category_id"] is None


@pytest.mark.anyio
async def test_recategorization_commit_updates_only_current_users_transactions(
    client,
    register_user,
) -> None:
    first_user = await register_user(email="recategorize-owner@example.com")
    second_user = await register_user(email="recategorize-other@example.com")

    first_transaction = await client.post(
        "/transactions",
        json={
            "amount": 40,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "ADDEBITO SEPA VODAFONE",
        },
        headers=first_user["headers"],
    )
    second_transaction = await client.post(
        "/transactions",
        json={
            "amount": 40,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "ADDEBITO SEPA VODAFONE",
        },
        headers=second_user["headers"],
    )

    commit_response = await client.post(
        "/transactions/recategorize",
        json={"commit": True, "limit": 10},
        headers=first_user["headers"],
    )
    first_list = await client.get("/transactions", headers=first_user["headers"])
    second_list = await client.get("/transactions", headers=second_user["headers"])

    assert commit_response.status_code == 200
    assert commit_response.json()["updated_count"] >= 1
    first_persisted = next(
        item for item in first_list.json()["items"] if item["id"] == first_transaction.json()["id"]
    )
    second_persisted = next(
        item for item in second_list.json()["items"] if item["id"] == second_transaction.json()["id"]
    )
    assert first_persisted["category_id"] is not None
    assert second_persisted["category_id"] is None
