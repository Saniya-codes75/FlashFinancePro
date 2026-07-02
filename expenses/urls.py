from django.urls import path
from . import views
from .views import (
    AddExpenseAI, ExpenseSummaryAPI, DeleteExpenseAPI, 
    RegisterUserAPI, CustomLoginAPI, FinancialAdvisorAPI
)

urlpatterns = [
    path('add-ai/', AddExpenseAI.as_view(), name='add_ai'),
    path('summary/', ExpenseSummaryAPI.as_view(), name='expense_summary'),
    path('delete/<int:pk>/', DeleteExpenseAPI.as_view(), name='delete_expense'),
    path('auth/register/', RegisterUserAPI.as_view(), name='auth_register'),
    path('auth/login/', CustomLoginAPI.as_view(), name='auth_login'),
    path('advisor/', FinancialAdvisorAPI.as_view(), name='financial_advisor'),
    path('update-budget/', views.UpdateBudgetAPI.as_view(), name='update_budget'),
    path('scan-receipt/', views.ReceiptScannerAPI.as_view(), name='scan_receipt'),
    
    # Savings and streaks
    path('savings/', views.manage_savings_goals, name='manage_savings'),
    path('savings/update/<int:goal_id>/', views.update_goal_progress, name='update_savings'),
    path('streak/', views.get_user_streak, name='user_streak'),
    path('bulk_delete_old_records/', views.bulk_delete_old_records, name='bulk_delete_records'),
    
    # Core Expense clean utility
    path('bulk_delete_expenses/', views.bulk_delete_expenses, name='bulk_delete_expenses'),
]



# from django.urls import path
# from . import views
# from .views import (
#     AddExpenseAI, ExpenseSummaryAPI, DeleteExpenseAPI, 
#     RegisterUserAPI, CustomLoginAPI, FinancialAdvisorAPI
# )

# urlpatterns = [
#     path('add-ai/', AddExpenseAI.as_view(), name='add_ai'),
#     path('summary/', ExpenseSummaryAPI.as_view(), name='expense_summary'),
#     path('delete/<int:pk>/', DeleteExpenseAPI.as_view(), name='delete_expense'),
#     path('auth/register/', RegisterUserAPI.as_view(), name='auth_register'),
#     path('auth/login/', CustomLoginAPI.as_view(), name='auth_login'),
#     path('advisor/', FinancialAdvisorAPI.as_view(), name='financial_advisor'),
#     path('update-budget/', views.UpdateBudgetAPI.as_view(), name='update_budget'),
#     path('scan-receipt/', views.ReceiptScannerAPI.as_view(), name='scan_receipt'),
    
#     # Savings and gamification endpoints
#     path('savings/', views.manage_savings_goals, name='manage_savings'),
#     path('savings/update/<int:goal_id>/', views.update_goal_progress, name='update_savings'),
#     path('streak/', views.get_user_streak, name='user_streak'),
#     path('bulk_delete_old_records/', views.bulk_delete_old_records, name='bulk_delete_records'),
#     path('bulk_delete_expenses/', views.bulk_delete_expenses, name='bulk_delete_expenses'),
# ]
