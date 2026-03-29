from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'currency', 'expense_date']
    search_fields = ['title', 'description', 'paid_by']
    ordering_fields = ['expense_date', 'amount', 'amount_base']
