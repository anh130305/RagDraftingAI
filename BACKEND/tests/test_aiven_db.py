import os
import sys
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.core.config import settings

def test_connection():
    print("=== Testing Aiven Cloud Database Connection ===")
    
    url = settings.CLOUD_DATABASE_URL
    if not url:
        print("ERROR: CLOUD_DATABASE_URL is not set in .env")
        return

    safe_url = url.split('@')[-1]
    print(f"Attempting to connect to: {safe_url}")

    connect_args = {}
    if settings.CLOUD_DB_SSL_CA:
        connect_args["sslrootcert"] = settings.CLOUD_DB_SSL_CA
        print(f"Using CA cert: {settings.CLOUD_DB_SSL_CA}")
    
    if connect_args:
        connect_args["sslmode"] = "verify-ca"
        print("SSL Mode: verify-ca")

    try:
        connect_args["connect_timeout"] = 10
        engine = create_engine(url, connect_args=connect_args)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();")).scalar()
            print("\n✅ SUCCESS! Connected to Aiven Cloud Database.")
            print(f"Database Version: {result}")
            
            # Additional test for schema
            tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")).fetchall()
            print(f"\nFound tables: {[t[0] for t in tables]}")
            
    except Exception as e:
        print("\n❌ FAILED to connect to Aiven Cloud Database.")
        print(f"Error details: {e}")

if __name__ == "__main__":
    test_connection()
