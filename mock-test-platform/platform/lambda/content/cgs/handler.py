"""Conceptual Gap Service — STUB. Activates when >1000 submissions/day."""


def lambda_handler(event, context):
    return {"statusCode": 503, "body": '{"error":"CGS not active — activate flag:cgs_active"}'}
