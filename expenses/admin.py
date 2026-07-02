from django.contrib import admin
from .models import Expense

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    # We explicitly define the exact 5 tracking variables present in our model
    list_display = ['title', 'amount', 'category', 'user', 'created_at']
    list_filter = ['category', 'user', 'created_at']
    search_fields = ['title', 'category']



