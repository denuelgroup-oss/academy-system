import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from django.db import transaction
from apps.clients.models import Client
from apps.sales.models import Invoice
from apps.attendance.models import ClientAttendance

print("Cleaning up database...")

with transaction.atomic():
    # Delete attendance records first (foreign key constraint)
    attendance_count = ClientAttendance.objects.count()
    ClientAttendance.objects.all().delete()
    print(f"  Deleted {attendance_count} attendance records")
    
    # Delete invoices
    invoice_count = Invoice.objects.count()
    Invoice.objects.all().delete()
    print(f"  Deleted {invoice_count} invoices")
    
    # Delete all clients
    client_count = Client.objects.count()
    Client.objects.all().delete()
    print(f"  Deleted {client_count} clients")

print("\n=== Cleanup Complete ===")
print(f"Database is now empty of clients, invoices, and attendance records")

# Verify
remaining = Client.objects.count()
print(f"Remaining clients: {remaining}")
