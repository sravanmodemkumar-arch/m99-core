"""Exam Processing Service — batch result ingestion from R2 locked files. Active v1."""
import json
import boto3
import time
import os
from shared.db import get_session
from shared.config import EPS_CHUNK_SIZE

s3 = boto3.client("s3")
R2_BUCKET = os.environ.get("R2_BUCKET", "mock-test-content")


def lambda_handler(event, context):
    """Triggered by S3/R2 event when a batch result file is locked."""
    records = event.get("Records", [])
    processed = 0
    for record in records:
        key = record["s3"]["object"]["key"]
        if not key.startswith("batch/") or not key.endswith(".json"):
            continue
        processed += _process_batch(key)
    return {"statusCode": 200, "body": json.dumps({"processed": processed})}


def _process_batch(key: str) -> int:
    obj = s3.get_object(Bucket=R2_BUCKET, Key=key)
    batch = json.loads(obj["Body"].read())

    tenant_id = batch["tenant_id"]
    pg_host = batch["pg_host"]
    schema = batch["schema_name"]
    results = batch["results"]

    with get_session(pg_host, schema) as session:
        for chunk in _chunks(results, EPS_CHUNK_SIZE):
            _insert_results(session, chunk, tenant_id)

    # Delete locked file from R2 after successful write
    s3.delete_object(Bucket=R2_BUCKET, Key=key)
    return len(results)


def _insert_results(session, results: list, tenant_id: str):
    from sqlalchemy import text
    now = int(time.time() * 1000)
    rows = [
        {
            "uid": r["uid"],
            "qid": r["qid"],
            "attempt_no": r["attempt_no"],
            "tenant_id": tenant_id,
            "test_id": r["test_id"],
            "module_id": r["module_id"],
            "score": r["score"],
            "correct": r["correct"],
            "wrong": r["wrong"],
            "unattempted": r["unattempted"],
            "answers": json.dumps(r["answers"]),
            "submitted_at": r.get("submitted_at", now),
        }
        for r in results
    ]
    # Batch INSERT — never row-by-row
    session.execute(
        text("""
            INSERT INTO results
              (uid, qid, attempt_no, tenant_id, test_id, module_id, score, correct, wrong, unattempted, answers, submitted_at)
            VALUES
              (:uid, :qid, :attempt_no, :tenant_id, :test_id, :module_id, :score, :correct, :wrong, :unattempted, :answers::jsonb, :submitted_at)
            ON CONFLICT (uid, qid, attempt_no) DO NOTHING
        """),
        rows,
    )


def _chunks(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]
