import base64

import pytest

from app.repositories.transactions import TransactionRepository


def encode_csv(content: str) -> str:
    return base64.b64encode(content.encode("utf-8")).decode("ascii")


def build_commit_payload(
    preview_payload: dict[str, object],
    *,
    rows: list[dict[str, object]] | None = None,
    confirm_duplicate_candidates: bool = False,
) -> dict[str, object]:
    return {
        "filename": preview_payload["filename"],
        "batch_identifier": preview_payload["batch_identifier"],
        "preview_fingerprint": preview_payload["preview_fingerprint"],
        "mapping": preview_payload["detected_mapping"],
        "rows": rows if rows is not None else preview_payload["rows"],
        "confirm_duplicate_candidates": confirm_duplicate_candidates,
    }


@pytest.mark.anyio
async def test_csv_preview_supports_comma_and_semicolon_delimiters(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    account_id = account_response.json()["id"]

    semicolon_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv(
                "Data;Descrizione;Importo\n12/07/2026;Supermercato;-42,80\n"
            ),
            "account_id": account_id,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )
    comma_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv(
                "Date,Description,Amount\n2026-07-12,Salary,1200.00\n"
            ),
            "account_id": account_id,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )

    assert semicolon_response.status_code == 200
    assert semicolon_response.json()["detected_delimiter"] == ";"
    assert semicolon_response.json()["rows"][0]["type"] == "expense"
    assert semicolon_response.json()["rows"][0]["amount"] == 42.8
    assert semicolon_response.json()["preview_fingerprint"]

    assert comma_response.status_code == 200
    assert comma_response.json()["detected_delimiter"] == ","
    assert comma_response.json()["rows"][0]["type"] == "income"
    assert comma_response.json()["rows"][0]["amount"] == 1200


@pytest.mark.anyio
async def test_csv_preview_supports_decimal_comma_and_debit_credit_columns(
    client,
    register_user,
) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    account_id = account_response.json()["id"]

    response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv(
                "Data;Descrizione;Addebito;Accredito\n12/07/2026;Affitto;850,35;\n13/07/2026;Stipendio;;1.500,00\n"
            ),
            "mapping": {
                "date": "Data",
                "description": "Descrizione",
                "debit": "Addebito",
                "credit": "Accredito",
            },
            "account_id": account_id,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert [row["type"] for row in payload["rows"]] == ["expense", "income"]
    assert payload["rows"][0]["amount"] == 850.35
    assert payload["rows"][1]["amount"] == 1500.0


@pytest.mark.anyio
async def test_csv_preview_rejects_invalid_or_oversized_files(
    client_factory,
) -> None:
    async with client_factory(csv_import_max_bytes=32) as limited_client:
        register_response = await limited_client.post(
            "/auth/register",
            json={"name": "CSV User", "email": "csv-limit@example.com", "password": "password123"},
        )
        headers = {
            "Authorization": f"Bearer {register_response.json()['access_token']}",
        }

        invalid_response = await limited_client.post(
            "/transactions/import/preview",
            json={
                "filename": "bank.pdf",
                "content_base64": encode_csv("Date,Description,Amount\n"),
                "currency": "EUR",
            },
            headers=headers,
        )
        oversized_response = await limited_client.post(
            "/transactions/import/preview",
            json={
                "filename": "bank.csv",
                "content_base64": encode_csv("A" * 128),
                "currency": "EUR",
            },
            headers=headers,
        )

    assert invalid_response.status_code == 422
    assert invalid_response.json()["error"]["code"] == "validation_error"
    assert oversized_response.status_code == 422
    assert oversized_response.json()["error"]["code"] == "validation_error"


@pytest.mark.anyio
async def test_csv_preview_does_not_persist_transactions(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )

    preview_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv(
                "Date,Description,Amount\n2026-07-12,Coffee,-3.50\n"
            ),
            "account_id": account_response.json()["id"],
            "currency": "EUR",
        },
        headers=auth["headers"],
    )
    transactions_response = await client.get("/transactions", headers=auth["headers"])

    assert preview_response.status_code == 200
    assert len(preview_response.json()["rows"]) == 1
    assert transactions_response.status_code == 200
    assert transactions_response.json()["items"] == []


@pytest.mark.anyio
async def test_csv_commit_is_atomic_and_retry_after_rollback_stays_deterministic(
    client,
    register_user,
    monkeypatch,
) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    preview_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv(
                "Date,Description,Amount\n2026-07-12,Coffee,-3.50\n2026-07-13,Salary,1500.00\n"
            ),
            "account_id": account_response.json()["id"],
            "currency": "EUR",
        },
        headers=auth["headers"],
    )
    preview_payload = preview_response.json()
    original_create = TransactionRepository.create
    create_calls = {"count": 0}

    def flaky_create(self, *args, **kwargs):
        create_calls["count"] += 1
        if create_calls["count"] == 2:
            raise ValueError("Injected row failure for rollback coverage.")
        return original_create(self, *args, **kwargs)

    monkeypatch.setattr(TransactionRepository, "create", flaky_create)
    failed_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(preview_payload),
        headers=auth["headers"],
    )
    transactions_after_failure = await client.get("/transactions", headers=auth["headers"])
    monkeypatch.setattr(TransactionRepository, "create", original_create)

    successful_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(preview_payload),
        headers=auth["headers"],
    )
    repeated_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(preview_payload),
        headers=auth["headers"],
    )
    transactions_after_success = await client.get("/transactions", headers=auth["headers"])

    assert failed_commit.status_code == 422
    assert failed_commit.json()["error"]["code"] == "validation_error"
    assert transactions_after_failure.json()["total"] == 0

    assert successful_commit.status_code == 200
    assert successful_commit.json()["imported_count"] == 2
    assert successful_commit.json()["skipped_count"] == 0

    assert repeated_commit.status_code == 200
    assert repeated_commit.json()["imported_count"] == 2
    assert repeated_commit.json()["warnings"] == [
        "This import batch was already processed. Returning the stored result."
    ]
    assert transactions_after_success.json()["total"] == 2


@pytest.mark.anyio
async def test_csv_commit_rejects_altered_rows_after_preview(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    preview_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv("Date,Description,Amount\n2026-07-12,Coffee,-3.50\n"),
            "account_id": account_response.json()["id"],
            "currency": "EUR",
        },
        headers=auth["headers"],
    )
    preview_payload = preview_response.json()
    altered_rows = [{**preview_payload["rows"][0], "description": "Tampered coffee"}]

    commit_response = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(preview_payload, rows=altered_rows),
        headers=auth["headers"],
    )

    assert commit_response.status_code == 422
    assert commit_response.json()["error"]["code"] == "validation_error"
    assert "preview" in commit_response.json()["error"]["message"].lower()


@pytest.mark.anyio
async def test_csv_preview_flags_duplicate_candidates_and_commit_requires_selection_and_confirmation(
    client,
    register_user,
) -> None:
    async def prepare_preview(email: str, filename: str) -> tuple[dict[str, object], dict[str, str]]:
        auth = await register_user(email=email)
        account_response = await client.post(
            "/accounts",
            json={"name": "Main", "balance": 1000, "currency": "EUR"},
            headers=auth["headers"],
        )
        account_id = account_response.json()["id"]
        await client.post(
            "/transactions",
            json={
                "account_id": account_id,
                "amount": 15.75,
                "currency": "EUR",
                "type": "expense",
                "date": "2026-07-12",
                "description": "Bar Centrale",
                "merchant": "Bar Centrale",
            },
            headers=auth["headers"],
        )

        preview_response = await client.post(
            "/transactions/import/preview",
            json={
                "filename": filename,
                "content_base64": encode_csv(
                    "Date,Description,Amount\n2026-07-12,Bar Centrale,-15.75\n"
                ),
                "account_id": account_id,
                "currency": "EUR",
            },
            headers=auth["headers"],
        )
        return preview_response.json(), auth["headers"]

    preview_without_confirmation, headers_without_confirmation = await prepare_preview(
        "csv-dup-no-confirm@example.com",
        "bank-no-confirm.csv",
    )
    preview_without_selection, headers_without_selection = await prepare_preview(
        "csv-dup-no-selection@example.com",
        "bank-no-selection.csv",
    )
    preview_with_both, headers_with_both = await prepare_preview(
        "csv-dup-with-both@example.com",
        "bank-with-both.csv",
    )

    row_without_confirmation = preview_without_confirmation["rows"][0]
    row_without_selection = preview_without_selection["rows"][0]
    row_with_both = preview_with_both["rows"][0]

    commit_without_confirmation = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(
            preview_without_confirmation,
            rows=[{**row_without_confirmation, "selected": True}],
            confirm_duplicate_candidates=False,
        ),
        headers=headers_without_confirmation,
    )
    commit_without_selection = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(
            preview_without_selection,
            rows=[{**row_without_selection, "selected": False}],
            confirm_duplicate_candidates=True,
        ),
        headers=headers_without_selection,
    )
    commit_with_both = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(
            preview_with_both,
            rows=[{**row_with_both, "selected": True}],
            confirm_duplicate_candidates=True,
        ),
        headers=headers_with_both,
    )

    assert row_without_confirmation["duplicate_candidate"] is True
    assert row_without_confirmation["selected"] is False

    assert commit_without_confirmation.status_code == 200
    assert commit_without_confirmation.json()["imported_count"] == 0
    assert commit_without_confirmation.json()["skipped_count"] == 1

    assert commit_without_selection.status_code == 422
    assert commit_without_selection.json()["error"]["code"] == "validation_error"

    assert commit_with_both.status_code == 200
    assert commit_with_both.json()["imported_count"] == 1


@pytest.mark.anyio
async def test_csv_batches_are_isolated_per_authenticated_user(client, register_user) -> None:
    first_user = await register_user(email="csv-owner@example.com")
    second_user = await register_user(email="csv-other@example.com")

    first_account = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=first_user["headers"],
    )
    second_account = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=second_user["headers"],
    )
    csv_payload = {
        "filename": "bank.csv",
        "content_base64": encode_csv("Date,Description,Amount\n2026-07-12,Rent,-400\n"),
        "currency": "EUR",
    }

    first_preview = await client.post(
        "/transactions/import/preview",
        json={**csv_payload, "account_id": first_account.json()["id"]},
        headers=first_user["headers"],
    )
    second_preview = await client.post(
        "/transactions/import/preview",
        json={**csv_payload, "account_id": second_account.json()["id"]},
        headers=second_user["headers"],
    )

    first_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(first_preview.json()),
        headers=first_user["headers"],
    )
    second_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(second_preview.json()),
        headers=second_user["headers"],
    )
    first_transactions = await client.get("/transactions", headers=first_user["headers"])
    second_transactions = await client.get("/transactions", headers=second_user["headers"])

    assert first_commit.status_code == 200
    assert second_commit.status_code == 200
    assert first_transactions.json()["total"] == 1
    assert second_transactions.json()["total"] == 1


@pytest.mark.anyio
async def test_csv_import_rejects_valid_cross_user_commit_and_unexpected_user_id_field(
    client,
    register_user,
) -> None:
    first_user = await register_user(email="csv-owner-two@example.com")
    second_user = await register_user(email="csv-other-two@example.com")

    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=first_user["headers"],
    )
    preview_response = await client.post(
        "/transactions/import/preview",
        json={
            "filename": "bank.csv",
            "content_base64": encode_csv("Date,Description,Amount\n2026-07-12,Rent,-400\n"),
            "account_id": account_response.json()["id"],
            "currency": "EUR",
        },
        headers=first_user["headers"],
    )
    preview_payload = preview_response.json()

    foreign_commit = await client.post(
        "/transactions/import/commit",
        json=build_commit_payload(preview_payload),
        headers=second_user["headers"],
    )
    spoofed_commit = await client.post(
        "/transactions/import/commit",
        json={
            **build_commit_payload(preview_payload),
            "user_id": "spoofed-user",
        },
        headers=first_user["headers"],
    )

    assert foreign_commit.status_code == 404
    assert foreign_commit.json()["error"]["code"] == "not_found"
    assert spoofed_commit.status_code == 422
    assert spoofed_commit.json()["error"]["code"] == "validation_error"
