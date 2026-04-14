import os
import django
import sqlite3

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client

# Get the list of clients from before_csv_import backup
sqlite_db = r"c:\Users\Administrateur\Academy App\backend\db.backup.before_csv_import_20260402_232718.sqlite3"
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

sqlite_cursor.execute("SELECT first_name, last_name FROM clients_client")
original_clients = {(row['first_name'], row['last_name']) for row in sqlite_cursor.fetchall()}
sqlite_conn.close()

print(f"Original clients (before CSV import): {len(original_clients)}")
for first, last in sorted(original_clients):
    print(f"  - {first} {last}")

# Find and mark clients for deletion (those from CSV import)
mysql_clients = Client.objects.all()
csv_imported = []

for client in mysql_clients:
    if (client.first_name, client.last_name) not in original_clients:
        csv_imported.append(client)
        print(f"Marked for removal: {client.first_name} {client.last_name}")

print(f"\nClients to remove (from CSV import): {len(csv_imported)}")
print(f"Clients to keep (original): {len(original_clients)}")

# Ask for confirmation
confirm = input("\nRemove all CSV-imported duplicate clients? (yes/no): ")
if confirm.lower() == "yes":
    Client.objects.filter(id__in=[c.id for c in csv_imported]).delete()
    print(f"\nDeleted {len(csv_imported)} duplicate clients")
    print(f"Remaining clients: {Client.objects.count()}")
else:
    print("Cleanup cancelled.")
