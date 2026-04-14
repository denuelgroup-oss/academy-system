#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client

# Create a new test client
test_client = Client.objects.create(
    first_name="Test",
    last_name="Client",
    plan=None  # Explicitly set to None
)

print(f"Created client: {test_client.full_name}")
print(f"Plan: {test_client.plan}")
print(f"Plan ID: {test_client.plan_id}")

# Now retrieve it to see if it changed
retrieved = Client.objects.get(id=test_client.id)
print(f"Retrieved plan: {retrieved.plan}")
print(f"Retrieved plan ID: {retrieved.plan_id}")

# Delete the test client
test_client.delete()
