from sqlalchemy import Column, String, BigInteger, Boolean, ARRAY, Float, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Tenant(Base):
    """Global tenants table — source of truth. KV is cache only."""
    __tablename__ = "tenants"

    tenant_id = Column(UUID, primary_key=True)
    slug = Column(String, unique=True, nullable=False)
    schema_name = Column(String, nullable=False)       # always tenant_{slug}
    pg_host = Column(String, nullable=False)           # resolved dynamically, never hardcoded
    tier = Column(String, nullable=False, default="T1")
    modules = Column(JSONB, nullable=False, default=list)
    theme = Column(JSONB, nullable=False, default=dict)
    created_at = Column(BigInteger, nullable=False)


class User(Base):
    """Per-tenant schema: users table."""
    __tablename__ = "users"

    uid = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    phone = Column(String, nullable=False)
    name = Column(String, nullable=False, default="")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(BigInteger, nullable=False)


class Result(Base):
    """Append-only results. PK: (uid, qid, attempt_no). INSERT only, never UPDATE."""
    __tablename__ = "results"

    uid = Column(UUID, primary_key=True)
    qid = Column(String, primary_key=True)
    attempt_no = Column(Integer, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    test_id = Column(String, nullable=False)
    module_id = Column(String, nullable=False)
    score = Column(Float, nullable=False)              # full float, no rounding
    correct = Column(Integer, nullable=False)
    wrong = Column(Integer, nullable=False)
    unattempted = Column(Integer, nullable=False)
    answers = Column(JSONB, nullable=False)
    submitted_at = Column(BigInteger, nullable=False)


class Checkpoint(Base):
    """TSF snapshot synced during exam."""
    __tablename__ = "checkpoints"

    session_id = Column(String, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    uid = Column(UUID, nullable=False)
    tsf = Column(JSONB, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class WeaknessSnapshot(Base):
    """Written by CGS (v2.5 stub — not active in v1)."""
    __tablename__ = "weakness_snapshot"

    uid = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    qid = Column(String, primary_key=True)
    weak_score = Column(Float, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
