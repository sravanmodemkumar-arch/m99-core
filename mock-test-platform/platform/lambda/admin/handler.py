"""
Admin Lambda — long-running operations unsuitable for CF Workers (> 50ms CPU):
  - Bulk question import with validation
  - Exam bundle rebuild from Global RDS questions
  - Analytics aggregation (tenant result scans)
  - PDF/image upload processing

Triggered via:
  - R2 event: eps/pending/*.json (exam results → results RDS)
  - API Gateway: POST /lambda/admin/bulk-import
  - API Gateway: POST /lambda/admin/rebuild-bundle
  - EventBridge: daily analytics rollup

Env vars (Lambda):
  GLOBAL_DB_URL   — PostgreSQL (questions + exams) read replica
  TENANT_DB_URL   — PostgreSQL (per-tenant results)
  CF_ACCOUNT_ID
  CF_KV_NAMESPACE_ID  — admin KV (for writing back bundle metadata)
  CF_R2_BUCKET        — mtp-exam-data
  CF_API_TOKEN
"""

import json
import os
import re
import logging
import boto3
import psycopg2
import urllib.request
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
R2_BUCKET = os.environ.get("CF_R2_BUCKET", "mtp-exam-data")

# ── DB helpers ────────────────────────────────────────────────────────────────

def _pg(url):
    return psycopg2.connect(url)

# ── CF KV / R2 helpers (REST API) ────────────────────────────────────────────

CF_BASE    = "https://api.cloudflare.com/client/v4"
CF_ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "")
CF_KV_NS   = os.environ.get("CF_KV_NAMESPACE_ID", "")
CF_TOKEN   = os.environ.get("CF_API_TOKEN", "")

def _cf_headers():
    return {"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"}

def _kv_put(key, value):
    url = f"{CF_BASE}/accounts/{CF_ACCOUNT}/storage/kv/namespaces/{CF_KV_NS}/values/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, data=value.encode(), headers=_cf_headers(), method="PUT")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def _kv_get(key):
    url = f"{CF_BASE}/accounts/{CF_ACCOUNT}/storage/kv/namespaces/{CF_KV_NS}/values/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, headers=_cf_headers())
    try:
        with urllib.request.urlopen(req) as r:
            return r.read().decode()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

# ── Question validator ────────────────────────────────────────────────────────

VALID_TYPES = {
    "S",   # MCQ single correct
    "M",   # MCQ multiple correct
    "N",   # Numerical
    "T",   # True/False
    "P",   # Passage (comprehension)
    "MA",  # Match the following
    "AR",  # Assertion-Reason
    "SC",  # Statement-based (choose correct statements)
    "SI",  # Sequence/ordering
    "FI",  # Fill in the blank
    "SA",  # Short answer
    "LA",  # Long answer
    "DI",  # Data interpretation
    "GR",  # Graph reading
    "CB",  # Caselet / case-based
    "CD",  # Code snippet (programming)
    "EX",  # Experiment based
    "IM",  # Image based
    "AU",  # Audio based
}

def _validate_question(q):
    errors = []
    if not q.get("type") or q["type"] not in VALID_TYPES:
        errors.append(f"Invalid or missing type: {q.get('type')}")
    if not q.get("body") and not q.get("text"):
        errors.append("Question must have body or text")
    if q.get("type") in ("S", "M", "T", "MA", "AR", "SC", "SI") and not q.get("options"):
        errors.append("MCQ/select type requires options")
    if q.get("type") == "S" and not q.get("answer"):
        errors.append("MCQ single requires answer key")
    return errors

# ── Bulk import ───────────────────────────────────────────────────────────────

def handle_bulk_import(event):
    body      = json.loads(event.get("body", "{}"))
    questions = body.get("questions", [])
    tenant_id = body.get("tenant_id", "default")
    if not questions:
        return {"statusCode": 400, "body": json.dumps({"error": "questions array required"})}

    created = 0
    updated = 0
    errors  = []
    index   = []

    # Load existing index
    raw_index = _kv_get(f"question_index:{tenant_id}")
    existing_index = json.loads(raw_index) if raw_index else []
    existing_map   = {x["qid"]: x for x in existing_index}

    for q in questions:
        errs = _validate_question(q)
        if errs:
            errors.append({"qid": q.get("qid"), "errors": errs})
            continue

        qid = q.get("qid") or _gen_qid()
        q["qid"] = qid
        q.setdefault("lang", "en")

        _kv_put(f"question:{tenant_id}:{qid}", json.dumps(q))

        preview = _question_preview(q)
        entry   = {"qid": qid, "type": q["type"], "subject": q.get("subject"), "topic": q.get("topic"), "lang": q.get("lang", "en"), "preview": preview}
        existing_map[qid] = entry

        if q.get("qid"):
            updated += 1
        else:
            created += 1

    # Write back merged index
    _kv_put(f"question_index:{tenant_id}", json.dumps(list(existing_map.values())))

    return {
        "statusCode": 200,
        "body": json.dumps({"created": created, "updated": updated, "errors": errors})
    }

# ── Bundle rebuild ────────────────────────────────────────────────────────────

def handle_rebuild_bundle(event):
    body      = json.loads(event.get("body", "{}"))
    exam_id   = body.get("exam_id")
    tenant_id = body.get("tenant_id", "default")
    if not exam_id:
        return {"statusCode": 400, "body": json.dumps({"error": "exam_id required"})}

    config_raw = _kv_get(f"exam:{tenant_id}:{exam_id}")
    if not config_raw:
        return {"statusCode": 404, "body": json.dumps({"error": "Exam not found"})}

    config   = json.loads(config_raw)
    sections = config.get("sections", [])
    bank     = {}
    total_qs = 0
    subjects = set()

    for section in sections:
        qids      = section.get("question_ids", [])
        questions = []
        for qid in qids:
            q_raw = _kv_get(f"question:{tenant_id}:{qid}")
            if not q_raw:
                logger.warning("Question %s not found for exam %s", qid, exam_id)
                continue
            q = json.loads(q_raw)
            questions.append(q)
            if q.get("subject"):
                subjects.add(q["subject"])
        bank[section["id"]] = questions
        total_qs += len(questions)

    # Write to R2 via S3-compatible client (Cloudflare R2 supports S3 API)
    s3.put_object(
        Bucket=R2_BUCKET,
        Key=f"bundles/exam-engine/{exam_id}/bank.json",
        Body=json.dumps(bank),
        ContentType="application/json",
    )

    # Update exam config
    config["status"]       = "published"
    config["total_qs"]     = total_qs
    config["subjects"]     = list(subjects)
    config["published_at"] = int(__import__("time").time() * 1000)
    _kv_put(f"exam:{tenant_id}:{exam_id}", json.dumps(config))

    # Update catalogue
    catalogue_raw = _kv_get(f"exam_catalogue:{tenant_id}")
    catalogue     = json.loads(catalogue_raw) if catalogue_raw else []
    idx = next((i for i, e in enumerate(catalogue) if e["id"] == exam_id), -1)
    entry = {
        "id":         exam_id,
        "title":      config.get("title"),
        "type":       config.get("type", "full"),
        "total_qs":   total_qs,
        "duration_s": config.get("duration_s", 3600),
        "marks":      config.get("marks"),
        "subjects":   list(subjects),
        "status":     "published",
    }
    if idx >= 0:
        catalogue[idx] = entry
    else:
        catalogue.insert(0, entry)
    _kv_put(f"exam_catalogue:{tenant_id}", json.dumps(catalogue))

    return {
        "statusCode": 200,
        "body": json.dumps({"ok": True, "exam_id": exam_id, "total_qs": total_qs})
    }

# ── EPS processor (exam result events) ───────────────────────────────────────

def handle_eps_event(event):
    """Process exam result payloads written to R2 eps/pending/*.json"""
    records = event.get("Records", [])
    processed = 0

    for record in records:
        key = record.get("s3", {}).get("object", {}).get("key", "")
        if not key.startswith("eps/pending/"):
            continue

        obj    = s3.get_object(Bucket=R2_BUCKET, Key=key)
        data   = json.loads(obj["Body"].read())
        result = data.get("result", {})

        try:
            db_url = os.environ.get("TENANT_DB_URL")
            if db_url:
                conn = _pg(db_url)
                cur  = conn.cursor()
                cur.execute(
                    """INSERT INTO exam_results
                       (session_id, uid, tenant_id, exam_id, score, correct, wrong, skipped, total_qs, elapsed_s, submitted_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,to_timestamp(%s/1000.0))
                       ON CONFLICT (session_id) DO NOTHING""",
                    (data["session_id"], data["uid"], data["tenant_id"], data["exam_id"],
                     result.get("score"), result.get("correct"), result.get("wrong"),
                     result.get("skipped"), result.get("total_qs"), data.get("elapsed_s"),
                     data.get("submitted_at"))
                )
                conn.commit()
                cur.close()
                conn.close()

            # Move to processed
            s3.copy_object(Bucket=R2_BUCKET, CopySource={"Bucket": R2_BUCKET, "Key": key},
                           Key=key.replace("eps/pending/", "eps/processed/"))
            s3.delete_object(Bucket=R2_BUCKET, Key=key)
            processed += 1

        except Exception as e:
            logger.error("EPS processing failed for %s: %s", key, e)

    return {"statusCode": 200, "body": json.dumps({"processed": processed})}

# ── Router ────────────────────────────────────────────────────────────────────

def _gen_qid():
    import time, random, string
    ts  = hex(int(time.time() * 1000))[2:].upper()
    rnd = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"Q{ts}{rnd}"

def _question_preview(q):
    if q.get("text"):
        return q["text"][:80]
    body = q.get("body", [])
    if body:
        first = body[0]
        if first.get("t") in ("tx", "mx"):
            return re.sub(r"<[^>]+>", "", first.get("v", ""))[:80]
    return q.get("qid", "")

def lambda_handler(event, context):
    source = event.get("source", "")

    # EventBridge or direct invocation
    if source == "admin.rebuild-bundle" or event.get("action") == "rebuild-bundle":
        return handle_rebuild_bundle(event)
    if source == "admin.bulk-import" or event.get("action") == "bulk-import":
        return handle_bulk_import(event)

    # API Gateway
    path   = event.get("rawPath") or event.get("path", "")
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "")

    if method == "POST" and "/bulk-import" in path:
        return handle_bulk_import(event)
    if method == "POST" and "/rebuild-bundle" in path:
        return handle_rebuild_bundle(event)

    # S3/R2 trigger (EPS)
    if event.get("Records"):
        return handle_eps_event(event)

    return {"statusCode": 404, "body": json.dumps({"error": "Unknown action"})}
