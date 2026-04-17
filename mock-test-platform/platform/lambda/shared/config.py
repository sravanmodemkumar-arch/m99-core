import os

# SAM env vars — tune without code change
EPS_CHUNK_SIZE = int(os.environ.get("EPS_CHUNK_SIZE", 100))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 4))
FLUSH_HOURS = int(os.environ.get("FLUSH_HOURS", 24))
TGM_MIN_TENANTS = int(os.environ.get("TGM_MIN_TENANTS", 20))
TGM_USER_THRESHOLD = int(os.environ.get("TGM_USER_THRESHOLD", 50000))

# RDS — pg_host always from global tenants table, never hardcoded
RDS_PORT = int(os.environ.get("RDS_PORT", 5432))
RDS_DB = os.environ.get("RDS_DB", "mocktest")
RDS_USER = os.environ.get("RDS_USER", "app")
RDS_PASSWORD = os.environ.get("RDS_PASSWORD", "")

# JWT
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", 24))

# R2
R2_BUCKET = os.environ.get("R2_BUCKET", "mock-test-content")

# Pool: one connection per Lambda invocation
DB_POOL_SIZE = 1
DB_MAX_OVERFLOW = 0
