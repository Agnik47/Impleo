from dotenv import load_dotenv
import os

load_dotenv()

groq_key = os.getenv("GROQ_API_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")

print("=" * 60)
print("API KEY CHECK")
print("=" * 60)

print(f"GROQ_API_KEY Found   : {bool(groq_key)}")
print(f"GEMINI_API_KEY Found : {bool(gemini_key)}")

print("\n")

# ==========================================================
# GROQ
# ==========================================================

try:
    from groq import Groq

    print("=" * 60)
    print("GROQ TEST")
    print("=" * 60)

    client = Groq(api_key=groq_key)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": "Reply with exactly: Groq is working"
            }
        ]
    )

    print("✅ Connection Successful")
    print("Response:", response.choices[0].message.content)

    print("\nAvailable Models:")
    print("-" * 40)

    models = client.models.list()

    for model in models.data:
        print(model.id)

except Exception as e:
    print("❌ Groq Error")
    print(e)


print("\n\n")


# ==========================================================
# GEMINI
# ==========================================================

try:
    from google import genai

    print("=" * 60)
    print("GEMINI TEST")
    print("=" * 60)

    client = genai.Client(api_key=gemini_key)

    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents="Reply with exactly: Gemini is working"
    )

    print("✅ Connection Successful")
    print("Response:", response.text)

    print("\nAvailable Models:")
    print("-" * 40)

    models = client.models.list()

    for model in models:
        print(model.name)

except Exception as e:
    print("❌ Gemini Error")
    print(e)