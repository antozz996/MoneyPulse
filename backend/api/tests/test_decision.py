from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_briefing_returns_deterministic_recommendation() -> None:
    response = client.post(
        "/v1/decision/briefing",
        json={
            "available_balance": 1650,
            "expected_income_today": 0,
            "essential_obligations": 420,
            "committed_spending": 75,
            "safety_buffer": 300,
            "planned_goal_contribution": 150,
            "currency": "EUR",
            "model_version": "1.0.0",
        },
    )

    assert response.status_code == 200
    assert response.json()["safe_to_spend_today"] == 705.0
    assert response.json()["risk_level"] == "safe"
