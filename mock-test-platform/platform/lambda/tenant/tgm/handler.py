"""Tenant Group Manager — STUB. Activates when >20 tenants or >50k users."""


def lambda_handler(event, context):
    return {"statusCode": 503, "body": '{"error":"TGM not active — activate flag:tgm_active"}'}
