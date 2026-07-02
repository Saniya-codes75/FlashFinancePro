# FlashFinance Pro ⚡

FlashFinance Pro is an AI-powered full-stack expense tracking and financial monitoring application. The application utilizes natural language processing (NLP) powered by the **Gemini 1.5 Flash** model to automatically extract, parse, and categorize unstructured transaction inputs (text or voice) into structured dashboard metrics in real time.

---

## 🚀 Key Features

*   **Brain-Dead Simple AI Tracking:** Enter sentences like *"Spent 500 on pizza"* or *"Bought a keyboard for 2000"*; the integrated Gemini AI extracts the title, cost, and context category automatically.
*   **🎙️ Speech-to-Text Integration:** Hands-free logging via integrated browser speech recognition engines optimized for localized accents (`en-IN`).
*   **📸 Receipt Scanner Integration:** Upload or drop invoices directly into the frontend interface to read raw receipt components.
*   **💡 Smart Financial Coaching:** Leverages a custom algorithmic advisory engine to provide real-time budget optimization recommendations and spend warnings.
*   **📊 Dynamic Visualizations:** Interactive real-time metrics layout highlighting target budgets, percentage utilization progress bars, and a categorized breakdown pie chart using `Recharts`.
*   **🎮 Gamification Core:** Features an embedded gamification milestone panel rewarding users for maintaining financial discipline metrics.
*   **📥 Native CSV Data Export:** One-click automated report compiling that injects a UTF-8 Byte Order Mark (BOM) for zero-glitch imports directly into Microsoft Excel or Google Sheets.

---

## 🛠️ Tech Stack & Architecture

### Backend Core
*   **Framework:** Django & Django REST Framework (DRF)
*   **AI Orchestration:** Google Generative AI SDK (`gemini-1.5-flash`)
*   **Authentication:** JWT (JSON Web Tokens) with standard request state authorization bindings
*   **Database:** SQLite / PostgreSQL (Structured Object Relations Model layer mapped via Django ORM)

### Frontend Engine
*   **Library:** React.js (Hooks, Virtual DOM, Global Axios client bindings)
*   **Charting Core:** Recharts Layout Module
*   **Styling Structure:** Advanced CSS Glassmorphic UI designs with responsive viewport layouts

---

## 📂 System File Architecture

```text
FlashFinancePro/
│
├── backend/
│   ├── manage.py
│   ├── settings.py
│   ├── urls.py
│   └── expenses/
│       ├── models.py      # Expense & MonthlyBudget schemas
│       ├── views.py       # AddExpenseAI, ExpenseSummaryAPI modules
│       └── urls.py
│
└── frontend/
    ├── public/
    └── src/
        ├── App.js         # Core Interface, Voice, Charts & API connectors
        ├── Login.js    # Authentication screen
        ├── App.css        # Glassmorphic UI layouts
        ├── ReceiptScanner.js
        └── GamificationPanel.js

