from django.contrib import admin
from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'amount', 'currency', 'expense_date', 'amount_base', 'base_currency']
    list_filter = ['category', 'currency']
    search_fields = ['title', 'description', 'paid_by']
    date_hierarchy = 'expense_date'
    readonly_fields = ['amount_base']
