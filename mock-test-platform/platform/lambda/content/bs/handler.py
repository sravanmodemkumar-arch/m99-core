"""Bundle Service — serves exam question bundles from R2. Active v1."""
import json
import boto3
import os

s3 = boto3.client("s3")
R2_BUCKET = os.environ.get("R2_BUCKET", "mock-test-content")


def lambda_handler(event, context):
    action = event.get("action")
    if action == "get_bundle":
        return _get_bundle(event)
    if action == "put_bundle":
        return _put_bundle(event)
    return {"statusCode": 400, "body": json.dumps({"error": "unknown action"})}


def _get_bundle(event):
    exam_id = event.get("exam_id", "")
    bundle_key = event.get("bundle_key", f"bundles/{exam_id}.json")
    try:
        obj = s3.get_object(Bucket=R2_BUCKET, Key=bundle_key)
        bundle = json.loads(obj["Body"].read())
        url = _presigned_url(bundle_key)
        return {"statusCode": 200, "body": json.dumps({"bundle_key": bundle_key, "url": url})}
    except s3.exceptions.NoSuchKey:
        return {"statusCode": 404, "body": json.dumps({"error": "bundle not found"})}


def _put_bundle(event):
    exam_id = event["exam_id"]
    bundle = event["bundle"]
    bundle_key = f"bundles/{exam_id}.json"
    s3.put_object(
        Bucket=R2_BUCKET,
        Key=bundle_key,
        Body=json.dumps(bundle),
        ContentType="application/json",
    )
    return {"statusCode": 200, "body": json.dumps({"bundle_key": bundle_key})}


def _presigned_url(key: str, expires: int = 3600) -> str:
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": R2_BUCKET, "Key": key},
        ExpiresIn=expires,
    )
