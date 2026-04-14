import os
import django
import sqlite3

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client
from django.db import transaction

# Get the list of 5 original clients from before CSV import
sqlite_db = r"c:\Users\Administrateur\Academy App\backend\db.backup.before_csv_import_20260402_232718.sqlite3"
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

sqlite_cursor.execute("SELECT first_name, last_name FROM clients_client")
original_clients = {(row['first_name'], row['last_name']) for row in sqlite_cursor.fetchall()}
sqlite_conn.close()

print("Keeping: 42 CSV-imported clients")
print("Deleting: 5 original clients + 42 duplicates")

mysql_clients = list(Client.objects.all())
to_delete = []

# Mark original 5 clients for deletion
for client in mysql_clients:
    if (client.first_name, client.last_name) in original_clients:
        to_delete.append(client)

# Also delete duplicate names (keep first occurrence, delete rest)
name_seen = {}
for client in mysql_clients:
    name_key = (client.first_name.lower(), client.last_name.lower())
    if name_key in name_seen:
        # This is a duplicate, mark for deletion
        to_delete.append(client)
    else:
        name_seen[name_key] = client

print(f"\nClients to delete: {len(to_delete)}")
print(f"Clients to keep: {len(mysql_clients) - len(to_delete)}")

confirm = input("Delete to get to 42 clients? (yes/no): ")
if confirm.lower() == "yes":
    with transaction.atomic():
        Client.objects.filter(id__in=[c.id for c in to_delete]).delete()
    remaining = Client.objects.count()
    print(f"\n✓ Deleted {len(to_delete)} clients")
    print(f"✓ Remaining clients: {remaining}")
else:
    print("Cancelled.")
