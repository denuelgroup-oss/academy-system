import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client

client_count = Client.objects.count()
print(f"\n✅ Total clients in database: {client_count}")

# Show a few samples
print("\nFirst 5 clients:")
for client in Client.objects.all()[:5]:
    print(f"  - {client.first_name} {client.last_name} ({client.status})")
