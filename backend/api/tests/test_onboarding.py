import pytest


@pytest.mark.anyio
async def test_onboarding_summary_starts_with_required_missing_fields(
    client,
    register_user,
) -> None:
    auth = await register_user()

    response = await client.get("/onboarding", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["profile"]["onboarding_status"] == "not_started"
    assert payload["can_complete"] is False
    assert "cycle_mode" in payload["profile"]["missing_setup_fields"]
    assert "primary_account" in payload["profile"]["missing_setup_fields"]
    assert "protected_balance" in payload["profile"]["missing_setup_fields"]


@pytest.mark.anyio
async def test_onboarding_can_be_completed_with_minimum_required_setup(
    client,
    register_user,
) -> None:
    auth = await register_user()

    start_response = await client.post("/onboarding", headers=auth["headers"])
    assert start_response.status_code == 200

    update_response = await client.patch(
        "/onboarding",
        json={
            "currency": "EUR",
            "locale": "it-IT",
            "default_cycle_mode": "CALENDAR_MONTH",
            "cycle_configured": True,
            "protected_balance": 0,
            "protected_balance_configured": True,
            "zero_balance_declared": True,
            "onboarding_step": "review",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["can_complete"] is True

    complete_response = await client.post(
        "/onboarding/complete",
        headers=auth["headers"],
    )

    assert complete_response.status_code == 200
    payload = complete_response.json()
    assert payload["profile"]["onboarding_status"] == "completed"
    assert payload["profile"]["onboarding_step"] == "completed"
    assert payload["profile"]["onboarding_completed_at"] is not None


@pytest.mark.anyio
async def test_onboarding_flags_missing_salary_day_for_salary_cycles(
    client,
    register_user,
) -> None:
    auth = await register_user()

    response = await client.patch(
        "/onboarding",
        json={
            "default_cycle_mode": "SALARY_CYCLE",
            "cycle_configured": True,
            "protected_balance": 150,
            "protected_balance_configured": True,
            "zero_balance_declared": True,
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert "salary_day" in payload["profile"]["missing_setup_fields"]
    assert payload["can_complete"] is False


@pytest.mark.anyio
async def test_onboarding_requires_authentication_in_app_mode(client) -> None:
    response = await client.get("/onboarding")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"
