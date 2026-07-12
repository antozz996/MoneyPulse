import pytest
from sqlalchemy import inspect

from app.main import create_app


@pytest.mark.anyio
async def test_financial_data_bundle_returns_default_profile_and_seeded_categories(
    client,
    register_user,
) -> None:
    auth = await register_user()

    response = await client.get("/financial-data", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "api"
    assert payload["financial_profile"]["currency"] == "EUR"
    assert payload["financial_profile"]["risk_profile"] == "BALANCED"
    assert payload["budgets"] == []
    assert len(payload["categories"]) >= 5
    assert any(category["key"] == "housing" for category in payload["categories"])


@pytest.mark.anyio
async def test_financial_profile_update_persists_values(client, register_user) -> None:
    auth = await register_user()

    update_response = await client.put(
        "/financial-profile",
        json={
            "currency": "EUR",
            "locale": "it-IT",
            "salary_day": 27,
            "protected_balance": 350,
            "risk_profile": "CONSERVATIVE",
            "default_cycle_mode": "SALARY_CYCLE",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["salary_day"] == 27
    assert update_response.json()["protected_balance"] == 350
    assert update_response.json()["risk_profile"] == "CONSERVATIVE"

    get_response = await client.get("/financial-profile", headers=auth["headers"])

    assert get_response.status_code == 200
    assert get_response.json()["locale"] == "it-IT"
    assert get_response.json()["default_cycle_mode"] == "SALARY_CYCLE"


@pytest.mark.anyio
async def test_financial_routes_require_authentication_in_app_mode(client) -> None:
    response = await client.get("/financial-data")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.anyio
async def test_financial_profile_is_scoped_to_the_authenticated_user(
    client,
    register_user,
) -> None:
    first_user = await register_user(email="profile-a@example.com")
    second_user = await register_user(email="profile-b@example.com")

    update_response = await client.put(
        "/financial-profile",
        json={
            "currency": "EUR",
            "locale": "it-IT",
            "salary_day": 25,
            "protected_balance": 410,
            "risk_profile": "CONSERVATIVE",
            "default_cycle_mode": "SALARY_CYCLE",
            "user_id": second_user["session"]["user"]["id"],
        },
        headers=first_user["headers"],
    )

    first_profile = await client.get("/financial-profile", headers=first_user["headers"])
    second_profile = await client.get("/financial-profile", headers=second_user["headers"])

    assert update_response.status_code == 200
    assert update_response.json()["user_id"] == first_user["session"]["user"]["id"]
    assert first_profile.status_code == 200
    assert second_profile.status_code == 200
    assert first_profile.json()["protected_balance"] == 410
    assert second_profile.json()["protected_balance"] == 0
    assert second_profile.json()["user_id"] == second_user["session"]["user"]["id"]


@pytest.mark.anyio
async def test_financial_routes_use_demo_user_when_demo_auth_mode_is_enabled(
    settings_factory,
) -> None:
    import httpx

    app = create_app(
        settings_factory(
            auth_mode="demo",
            demo_user_id="demo-user",
            demo_user_name="Demo User",
        )
    )
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/financial-data")

    assert response.status_code == 200
    payload = response.json()
    assert payload["financial_profile"]["user_id"] == "demo-user"
    assert payload["mode"] == "api"


def test_persistence_foundation_schema_is_available(settings_factory) -> None:
    app = create_app(settings_factory())
    engine = app.state.session_maker.kw["bind"]
    inspector = inspect(engine)

    assert "user_financial_profiles" in inspector.get_table_names()
    assert "categories" in inspector.get_table_names()
    assert "budgets" in inspector.get_table_names()

    account_columns = {column["name"] for column in inspector.get_columns("accounts")}
    goal_columns = {column["name"] for column in inspector.get_columns("goals")}

    assert {"account_type", "is_default", "status", "updated_at"}.issubset(account_columns)
    assert {"current_amount", "monthly_contribution", "priority", "status", "updated_at"}.issubset(goal_columns)


@pytest.mark.anyio
async def test_financial_data_bundle_includes_goals_budgets_and_recurring_items(
    client,
    register_user,
) -> None:
    auth = await register_user()
    categories_response = await client.get("/categories", headers=auth["headers"])
    housing_category_id = next(
        category["id"]
        for category in categories_response.json()
        if category["key"] == "housing"
    )
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1500, "currency": "EUR"},
        headers=auth["headers"],
    )

    await client.post(
        "/budgets",
        json={
            "category_id": housing_category_id,
            "amount": 850,
            "currency": "EUR",
            "period": "MONTHLY",
        },
        headers=auth["headers"],
    )
    await client.post(
        "/goals",
        json={
            "name": "Emergency fund",
            "target_amount": 5000,
            "current_amount": 400,
            "monthly_contribution": 150,
            "currency": "EUR",
            "priority": "IMPORTANT",
        },
        headers=auth["headers"],
    )
    await client.post(
        "/recurring-items",
        json={
            "account_id": account_response.json()["id"],
            "name": "Rent",
            "amount": 700,
            "currency": "EUR",
            "type": "expense",
            "category": "essential",
            "frequency": "monthly",
            "next_due_date": "2026-07-28",
            "status": "active",
        },
        headers=auth["headers"],
    )

    response = await client.get("/financial-data", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["budgets"]) == 1
    assert payload["budgets"][0]["category_id"] == housing_category_id
    assert len(payload["goals"]) == 1
    assert payload["goals"][0]["priority"] == "IMPORTANT"
    assert len(payload["recurring_events"]) == 1
    assert payload["recurring_events"][0]["frequency"] == "monthly"
