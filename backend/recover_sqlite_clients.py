import os
import django
import sqlite3

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client
from datetime import datetime

# Connect to SQLite backup
sqlite_db = r"c:\Users\Administrateur\Academy App\backend\db.backup.before_csv_import_20260402_232718.sqlite3"
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

# Get all clients from SQLite
sqlite_cursor.execute("SELECT * FROM clients_client")
sqlite_clients = sqlite_cursor.fetchall()

print(f"Found {len(sqlite_clients)} clients in SQLite backup")
print("\nExtracting clients:")

imported = 0
skipped = 0

for row in sqlite_clients:
    first_name = dict(row)['first_name'] or ''
    last_name = dict(row)['last_name'] or ''
    
    # Check if client already exists in MySQL
    existing = Client.objects.filter(
        first_name__iexact=first_name,
        last_name__iexact=last_name
    ).first()
    
    if existing:
        print(f"  ⊘ {first_name} {last_name} - already exists")
        skipped += 1
        continue
    
    # Create new client
    try:
        row_dict = dict(row)
        client = Client.objects.create(
            first_name=first_name,
            last_name=last_name,
            phone=row_dict.get('phone') or '',
            email=row_dict.get('email') or '',
            date_of_birth=row_dict.get('date_of_birth'),
            enrollment_date=row_dict.get('enrollment_date'),
            subscription_start=row_dict.get('subscription_start'),
            subscription_end=row_dict.get('subscription_end'),
            status=row_dict.get('status') or 'active',
            notes=row_dict.get('notes') or ''
        )
        print(f"  ✓ {first_name} {last_name} - imported")
        imported += 1
    except Exception as e:
        print(f"  ✗ {first_name} {last_name} - error: {e}")

sqlite_conn.close()

print(f"\n=== Import Complete ===")
print(f"Imported: {imported} clients")
print(f"Skipped: {skipped} (already exist)")

# Verify total
total = Client.objects.count()
print(f"\nTotal clients in database now: {total}")
