"""SQLite engine, session factory and the declarative base."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite has no time zones; every stored datetime is UTC)."""
    return datetime.now(UTC).replace(tzinfo=None)


def create_db_engine(database_path: Path) -> Engine:
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False, "timeout": 15},
    )

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def init_db(engine: Engine) -> None:
    from app import models  # noqa: F401  (register the tables on Base.metadata)

    Base.metadata.create_all(engine)
    _add_missing_columns(engine)


def _add_missing_columns(engine: Engine) -> None:
    """Columns added after the first release, for databases created before them (SQLite has no
    migrations here; adding a nullable column is safe)."""
    from sqlalchemy import inspect, text

    columns = {c["name"] for c in inspect(engine).get_columns("photos")}
    if "client_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE photos ADD COLUMN client_id VARCHAR(64)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_photos_sender_client_id "
                    "ON photos (sender_id, client_id)"
                )
            )


def get_db(request: Request) -> Iterator[Session]:
    session: Session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()
