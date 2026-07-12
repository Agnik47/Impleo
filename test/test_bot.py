from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

MODEL = "gemini-3.5-flash"

print("=" * 50)
print(f"Gemini Chat Bot ({MODEL})")
print("Type 'exit' to quit")
print("=" * 50)

chat_history = []

while True:
    user_input = input("\nYou: ")

    if user_input.lower() in ["exit", "quit"]:
        print("Bot: Goodbye!")
        break

    chat_history.append(
        {
            "role": "user",
            "parts": [{"text": user_input}]
        }
    )

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=chat_history
        )

        bot_response = response.text

        print(f"\nBot: {bot_response}")

        chat_history.append(
            {
                "role": "model",
                "parts": [{"text": bot_response}]
            }
        )

    except Exception as e:
        print("\nError:")
        print(e)