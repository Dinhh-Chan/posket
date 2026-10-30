"""Application factory. Run with: uvicorn app.main:app --port 8020"""

from __future__ import annotations

import logging
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import storage
from app.config import Settings
from app.db import create_db_engine, create_session_factory, init_db
from app.detector import create_detector
from app.errors import install_error_handlers
from app.routers import auth, friends, health, me, media, photos, poses

logger = logging.getLogger("app")


def _configure_logging() -> None:
    """Give the `app` loggers a handler when nothing else (e.g. pytest, uvicorn) set one up."""
    if not logging.getLogger().handlers and not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
        logger.addHandler(handler)
    if logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    if settings.secret_is_default:
        logger.warning(
            "POSECAM_SECRET is not set: using the development secret (not for production)"
        )
    storage.ensure_dirs(settings)
    init_db(app.state.engine)
    logger.info("data in %s, detector mode %s", settings.data_dir, settings.detector)
    if settings.detector_warmup:
        threading.Thread(
            target=app.state.detector.available, name="detector-warmup", daemon=True
        ).start()
    try:
        yield
    finally:
        app.state.detector.close()
        app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    _configure_logging()
    settings = settings or Settings.from_env()
    app = FastAPI(
        title="PoseCam API",
        version="1.0.0",
        description="Photo sharing with friends plus live pose guidance (docs/API.md).",
        lifespan=_lifespan,
    )
    app.state.settings = settings
    app.state.engine = create_db_engine(settings.database_path)
    app.state.session_factory = create_session_factory(app.state.engine)
    app.state.detector = create_detector(settings.detector, settings.models_dir)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    for module in (health, auth, me, friends, photos, media, poses):
        app.include_router(module.router)
    return app


app = create_app()
