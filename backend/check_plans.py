#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.clients.models import Client
from apps.plans.models import Plan

# Check remaining plans
print("All plans in database:")
for plan in Plan.objects.all():
    print(f"  - {plan.id}: {plan.name} ({plan.price} {plan.currency})")

print(f"\nTotal plans: {Plan.objects.count()}")

# Check existing clients
print(f"\nClients with plans assigned:")
clients_with_plans = Client.objects.filter(plan__isnull=False)
for client in clients_with_plans:
    print(f"  - {client.first_name} {client.last_name}: {client.plan.name if client.plan else 'None'}")

print(f"\nClients without plans (plan=NULL): {Client.objects.filter(plan__isnull=True).count()}")
print(f"Clients with plans: {clients_with_plans.count()}")
print(f"Total clients: {Client.objects.count()}")
