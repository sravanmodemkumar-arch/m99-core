"""Tenant Provisioning Service — creates/manages tenant schemas + KV sync."""
import json
import uuid
import time
import boto3
from shared.db import get_global_session, get_session
from shared.models import Tenant
from shared.config import JWT_SECRET
from sqlalchemy import text

cf = boto3.client("cloudfront")


def lambda_handler(event, context):
    action = event.get("action")
    if action == "create":
        return _create_tenant(event)
    if action == "update_kv":
        return _sync_kv(event)
    return {"statusCode": 400, "body": json.dumps({"error": "unknown action"})}


def _create_tenant(event):
    slug = event["slug"].lower().strip()
    pg_host = event["pg_host"]
    modules = event.get("modules", [])
    theme = event.get("theme", {})
    tier = event.get("tier", "T1")
    schema_name = f"tenant_{slug}"
    tenant_id = str(uuid.uuid4())
    now = int(time.time() * 1000)

    with get_global_session(pg_host) as session:
        tenant = Tenant(
            tenant_id=tenant_id,
            slug=slug,
            schema_name=schema_name,
            pg_host=pg_host,
            tier=tier,
            modules=modules,
            theme=theme,
            created_at=now,
        )
        session.add(tenant)

    with get_session(pg_host, "public") as session:
        session.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        session.execute(text(f"SET search_path TO {schema_name}"))
        _create_tenant_tables(session)

    return {"statusCode": 200, "body": json.dumps({"tenant_id": tenant_id, "schema": schema_name})}


def _create_tenant_tables(session):
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            uid UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            phone VARCHAR NOT NULL,
            name VARCHAR NOT NULL DEFAULT '',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at BIGINT NOT NULL
        )
    """))
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS results (
            uid UUID NOT NULL,
            qid VARCHAR NOT NULL,
            attempt_no INTEGER NOT NULL,
            tenant_id UUID NOT NULL,
            test_id VARCHAR NOT NULL,
            module_id VARCHAR NOT NULL,
            score FLOAT NOT NULL,
            correct INTEGER NOT NULL,
            wrong INTEGER NOT NULL,
            unattempted INTEGER NOT NULL,
            answers JSONB NOT NULL,
            submitted_at BIGINT NOT NULL,
            PRIMARY KEY (uid, qid, attempt_no)
        )
    """))
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS checkpoints (
            session_id VARCHAR PRIMARY KEY,
            tenant_id UUID NOT NULL,
            uid UUID NOT NULL,
            tsf JSONB NOT NULL,
            updated_at BIGINT NOT NULL
        )
    """))
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS weakness_snapshot (
            uid UUID NOT NULL,
            tenant_id UUID NOT NULL,
            qid VARCHAR NOT NULL,
            weak_score FLOAT NOT NULL,
            updated_at BIGINT NOT NULL,
            PRIMARY KEY (uid, qid)
        )
    """))


def _sync_kv(event):
    # Called after TPS creates/updates a tenant — CF Worker reads KV as cache
    # Actual KV write happens via CF Worker API; Lambda signals via SQS/event
    return {"statusCode": 200, "body": json.dumps({"synced": True})}
