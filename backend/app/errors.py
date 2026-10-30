"""API errors: every error response is `{"detail": "<code>", "message": "<Vietnamese text>"}`."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# code -> (HTTP status, default Vietnamese message)
ERRORS: dict[str, tuple[int, str]] = {
    "invalid_credentials": (401, "Sai tên đăng nhập hoặc mật khẩu"),
    "unauthorized": (401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại"),
    "forbidden": (403, "Bạn không có quyền thực hiện thao tác này"),
    "not_found": (404, "Không tìm thấy"),
    "username_taken": (409, "Tên đăng nhập đã có người dùng"),
    "already_friends": (409, "Hai bạn đã là bạn bè"),
    "request_exists": (409, "Bạn đã gửi lời mời kết bạn cho người này"),
    "cannot_friend_self": (400, "Bạn không thể kết bạn với chính mình"),
    "invalid_image": (400, "Tệp không phải ảnh hợp lệ"),
    "no_recipients": (400, "Bạn chưa có bạn bè nào để gửi ảnh"),
    "invalid_username": (
        422,
        "Tên đăng nhập gồm 3–20 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới",
    ),
    "caption_too_long": (422, "Chú thích tối đa 60 ký tự"),
    "validation_error": (422, "Dữ liệu gửi lên không hợp lệ"),
}

_STATUS_CODES = {401: "unauthorized", 403: "forbidden", 404: "not_found", 422: "validation_error"}


class ApiError(Exception):
    def __init__(self, code: str, message: str | None = None) -> None:
        status, default_message = ERRORS[code]
        super().__init__(code)
        self.code = code
        self.status_code = status
        self.message = message or default_message


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if status_code == 401 else None
    return JSONResponse(
        status_code=status_code, content={"detail": code, "message": message}, headers=headers
    )


async def _api_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return error_response(exc.status_code, exc.code, exc.message)


async def _validation_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    logger.debug("request validation failed: %s", exc.errors())
    status, message = ERRORS["validation_error"]
    fields = [str(err["loc"][-1]) for err in exc.errors() if err.get("loc")]
    if fields:
        message = f"{message}: {', '.join(dict.fromkeys(fields))}"
    return error_response(status, "validation_error", message)


async def _http_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _STATUS_CODES.get(exc.status_code, "error")
    message = ERRORS[code][1] if code in ERRORS else str(exc.detail)
    return error_response(exc.status_code, code, message)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
