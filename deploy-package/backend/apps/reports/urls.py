from django.urls import path
from .views import DashboardKPIView, FinancialReportView, ClientReportView, AttendanceReportView

urlpatterns = [
    path('dashboard/', DashboardKPIView.as_view(), name='dashboard-kpi'),
    path('financial/', FinancialReportView.as_view(), name='financial-report'),
    path('clients/', ClientReportView.as_view(), name='client-report'),
    path('attendance/', AttendanceReportView.as_view(), name='attendance-report'),
]
