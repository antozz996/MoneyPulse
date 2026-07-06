from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import Settings


class Base(DeclarativeBase):
    pass


def create_engine_from_settings(settings: Settings) -> Engine:
    connect_args = (
        {"check_same_thread": False}
        if settings.database_url.startswith("sqlite")
        else {}
    )

    return create_engine(settings.database_url, future=True, connect_args=connect_args)


def create_session_maker(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_database(engine: Engine) -> None:
    from app import models

    Base.metadata.create_all(engine)


def session_scope(session_maker: sessionmaker[Session]) -> Generator[Session, None, None]:
    session = session_maker()
    try:
        yield session
    finally:
        session.close()
