import os
import django
import sqlite3

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client
from django.db import transaction

# Get the 5 original clients from before CSV import
sqlite_db = r"c:\Users\Administrateur\Academy App\backend\db.backup.before_csv_import_20260402_232718.sqlite3"
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

sqlite_cursor.execute("SELECT * FROM clients_client")
original_clients = list(sqlite_cursor.fetchall())
sqlite_conn.close()

print(f"Deleting 42 CSV-imported clients")
print(f"Keeping 5 original clients:")

# Delete all current clients
Client.objects.all().delete()

# Restore only the 5 original clients
with transaction.atomic():
    for row in original_clients:
        client = Client.objects.create(
            first_name=row['first_name'],
            last_name=row['last_name'],
            phone=row['phone'] or '',
            email=row['email'] or '',
            date_of_birth=row['date_of_birth'],
            enrollment_date=row['enrollment_date'],
            subscription_start=row['subscription_start'],
            subscription_end=row['subscription_end'],
            status=row['status'],
            notes=row['notes'] or ''
        )
        print(f"  ✓ {client.first_name} {client.last_name}")

total = Client.objects.count()
print(f"\n✓ Total clients now: {total}")
