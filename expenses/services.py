import json
from google import genai

def analyze_expense_with_ai(user_text):
    # Initialize the client (ensure you've run 'pip install google-genai')
    client = genai.Client(api_key="AIzaSyBqBs7Y9KKReJclDXYr4yaKTBhZvM16Jm0")
    
    try:
        # Use the 2026 stable model name
        response = client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=f"Extract expense details from: '{user_text}'. Return ONLY JSON with keys: title, amount, category.",
            config={'response_mime_type': 'application/json'}
        )

        if response.text:
            # Successfully parsed!
            return json.loads(response.text)
        
        return {"title": "No response", "amount": 0, "category": "Others"}

    except Exception as e:
        # This will catch and print the specific 2026 error if it fails
        print(f"--- AI ERROR: {e} ---")
        return {"title": "Manual Entry", "amount": 0, "category": "Others"}
    
from datetime import timedelta

# 1. Configure Django REST Framework to use JWT tokens by default
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

# 2. Set the security rules for Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),  # Token expires in 1 day (keeps user logged in for a day)
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7), # Allows refreshing the session for a week
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),            # The prefix React will use in headers: "Bearer <token>"
}

# ai financial advisor card


def generate_financial_advice(expense_summary_text):
    """
    Passes the user's spending breakdown to Gemini to get smart, 
    actionable, and slightly witty financial tips.
    """
    client = genai.Client(api_key="AIzaSyBqBs7Y9KKReJclDXYr4yaKTBhZvM16Jm0")
    
    try:
        prompt = (
            f"You are a smart, insightful, and slightly witty personal financial coach. "
            f"Analyze this user's monthly spending breakdown data:\n\n{expense_summary_text}\n\n"
            f"Give exactly 3 highly specific, practical bullet points of advice to help them save money. "
            f"Keep your response concise, energetic, and formatting-friendly (use simple bullet points)."
        )

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        if response.text:
            return response.text.strip()
        
        return "You're doing great! Keep tracking your daily logs to generate deep insights."

    except Exception as e:
        print(f"--- ADVISOR AI ERROR: {e} ---")
        return "Unable to retrieve real-time financial coaching at this moment. Keep saving!"