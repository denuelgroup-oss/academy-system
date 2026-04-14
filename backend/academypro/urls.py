from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def root_view(_request):
    return JsonResponse(
        {
            'status': 'ok',
            'message': 'AcademyPRO backend is running',
            'api_base': '/api/',
            'admin': '/admin/',
        }
    )

urlpatterns = [
    path('', root_view),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/plans/', include('apps.plans.urls')),
    path('api/classes/', include('apps.classes.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/staff/', include('apps.staff.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/settings/', include('apps.settings_app.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
