from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
from .config import RDS_PORT, RDS_DB, RDS_USER, RDS_PASSWORD, DB_POOL_SIZE, DB_MAX_OVERFLOW


def _build_url(pg_host: str) -> str:
    return f"postgresql+psycopg2://{RDS_USER}:{RDS_PASSWORD}@{pg_host}:{RDS_PORT}/{RDS_DB}"


def get_engine(pg_host: str):
    return create_engine(
        _build_url(pg_host),
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_pre_ping=True,
    )


@contextmanager
def get_session(pg_host: str, schema: str):
    engine = get_engine(pg_host)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        session.execute(text(f"SET search_path TO {schema}, public"))
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


@contextmanager
def get_global_session(pg_host: str):
    yield from get_session(pg_host, "public")
