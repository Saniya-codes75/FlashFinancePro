# FlashFinancePro ⚡

An AI-powered, full-stack personal finance and expense tracking application. FlashFinancePro leverages advanced Natural Language Processing (NLP) to parse natural language financial logs and automatically categorize transactions into a structured dashboard.

---

## 🚀 Key Features

* **AI-Powered Expense Parsing:** Uses **Gemini 1.5 Flash** to extract structured JSON data (amount, category, merchant, date) from messy, natural language text inputs.
* **Smart Budgeting & Analytics:** Tracks spending habits against customized monthly budgets and automatically calculates real-time insights.
* **Goal Tracking:** Set and monitor long-term savings targets with automated progress bars.
* **User Streaks:** Features a built-in gamification engine that tracks financial logging consistency to encourage healthy financial habits.
* **Full-Stack Architecture:** A fast and responsive React frontend seamlessly integrated with a robust Django REST Framework backend.

---

## 🛠️ Tech Stack

### Backend
* **Framework:** Django & Django REST Framework (Python)
* **AI Integration:** Google Gemini API (Gemini 1.5 Flash Model)
* **Database:** SQLite (Development) / PostgreSQL compatible architecture
* **Environment Management:** Python Virtual Environments (`penv`) & `python-dotenv`

### Frontend
* **Library:** React.js
* **Styling:** Tailwind CSS / Modern UI Components
* **State Management & Routing:** React Router & Axios for API consumption

---

## 📂 Project Structure

```text
FlashFinancePro/
│
├── core/                       # Django project configuration settings
├── expenses/                   # Django application (Models, Views, AI Services)
│   ├── migrations/             # Database tracking history
│   ├── models.py               # Expense, Budget, Savings Target models
│   ├── services.py             # Gemini API structural extraction logic
│   └── views.py                # REST API endpoints
│
├── flash-finance-frontend/     # React.js frontend application
│
├── .gitignore                  # Local environment file protection
├── manage.py                   # Django management script
└── README.md                   # Project documentation

🔒 License
This project is licensed under the MIT License - see the LICENSE file for details.
