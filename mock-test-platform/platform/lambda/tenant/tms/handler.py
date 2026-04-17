"""Tenant Migration Service — STUB. Activates on first tier migration."""


def lambda_handler(event, context):
    return {"statusCode": 503, "body": '{"error":"TMS not active — activate flag:tms_active"}'}
