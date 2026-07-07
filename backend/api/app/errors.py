from dataclasses import dataclass
from typing import Any


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: Any = None


def not_found_error(resource: str, resource_id: int) -> ApiError:
    return ApiError(
        status_code=404,
        code="not_found",
        message=f"{resource} {resource_id} was not found.",
        details={"resource": resource, "resource_id": resource_id},
    )


def validation_error(message: str, details: Any = None) -> ApiError:
    return ApiError(
        status_code=422,
        code="validation_error",
        message=message,
        details=details,
    )


def normalize_error_details(details: Any) -> Any:
    if isinstance(details, list):
        return [normalize_error_details(item) for item in details]

    if isinstance(details, dict):
        normalized: dict[str, Any] = {}

        for key, value in details.items():
            if key == "ctx" and isinstance(value, dict):
                normalized[key] = {
                    nested_key: (
                        str(nested_value)
                        if isinstance(nested_value, Exception)
                        else normalize_error_details(nested_value)
                    )
                    for nested_key, nested_value in value.items()
                }
                continue

            normalized[key] = normalize_error_details(value)

        return normalized

    if isinstance(details, tuple):
        return [normalize_error_details(item) for item in details]

    return details
