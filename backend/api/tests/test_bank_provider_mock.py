from app.services.bank_providers import MockBankProvider


def test_mock_bank_provider_is_deterministic_for_foundation_sync() -> None:
    provider = MockBankProvider()

    started = provider.start_connection(user_id="user-1", institution_id="sandbox")
    completed = provider.complete_connection(provider_reference=started.provider_reference)
    synced = provider.sync_connection(external_connection_id=completed.external_connection_id)

    assert started.institution_name == "Mock Bank Sandbox"
    assert completed.external_connection_id == "mock-connection::user-1::sandbox"
    assert len(completed.accounts) == 2
    assert synced.accounts[0].name == "Mock checking"
    assert len(synced.transactions) == 3
    assert synced.transactions[0].currency == "EUR"
