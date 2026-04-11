import os
import sys
import cloudinary
import cloudinary.api
from dotenv import load_dotenv

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def verify():
    print("=== Cloudinary Configuration Verification ===")
    
    # Load .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded .env from {env_path}")
    else:
        print("Warning: .env file not found. Using current environment variables.")

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    print(f"Cloud Name: {cloud_name}")
    print(f"API Key: {api_key}")
    print(f"API Secret: {'*' * len(api_secret) if api_secret else 'MISSING'}")

    if not all([cloud_name, api_key, api_secret]) or cloud_name == "YOUR_CLOUD_NAME":
        print("\n[ERROR] Cloudinary credentials are missing or set to placeholders!")
        return

    try:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        
        print("\nTesting connectivity...")
        response = cloudinary.api.ping()
        print(f"[SUCCESS] Connection successful! Ping response: {response}")
        
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {str(e)}")

if __name__ == "__main__":
    verify()
