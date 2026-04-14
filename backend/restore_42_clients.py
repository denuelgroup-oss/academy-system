import os
import django
import sqlite3

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client
from django.db import transaction

# Get first 42 clients from before_pending_invoice backup
sqlite_db = r"c:\Users\Administrateur\Academy App\backend\db.backup.before_pending_invoice_import_20260402_232903.sqlite3"
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row

sqlite_cursor = sqlite_conn.cursor()
sqlite_cursor.execute("SELECT * FROM clients_client ORDER BY id LIMIT 42")
clients_to_restore = list(sqlite_cursor.fetchall())
sqlite_conn.close()

print(f"Restoring {len(clients_to_restore)} clients from backup")

with transaction.atomic():
    for row in clients_to_restore:
        Client.objects.create(
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

total = Client.objects.count()
print(f"\n✓ Restored {len(clients_to_restore)} clients")
print(f"✓ Total in database: {total}")
