from dotenv import load_dotenv
from google import genai
import os

# Load .env file
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

print(f"API Key Found: {bool(api_key)}")

client = genai.Client(api_key=api_key)

print("\nAvailable Gemini Models")
print("=" * 60)

try:
    for model in client.models.list():
        print(f"Name: {model.name}")

        # Some SDK versions expose supported actions
        if hasattr(model, "supported_actions"):
            print(f"Actions: {model.supported_actions}")

        print("-" * 60)

except Exception as e:
    print("Error while listing models:")
    print(e)