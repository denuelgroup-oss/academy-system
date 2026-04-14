#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from apps.plans.models import Plan

# Find and delete U13 plan
u13_plans = Plan.objects.filter(name__icontains='U13')
print(f"Found {u13_plans.count()} plan(s) with U13:")
for plan in u13_plans:
    print(f"  - {plan.id}: {plan.name} ({plan.price} {plan.currency})")
    plan.delete()
    print(f"    ✓ Deleted")

# Also check for any "Après midi" plans
apres_midi_plans = Plan.objects.filter(name__icontains='Après midi')
print(f"\nFound {apres_midi_plans.count()} plan(s) with 'Après midi':")
for plan in apres_midi_plans:
    print(f"  - {plan.id}: {plan.name} ({plan.price} {plan.currency})")

print("\n✓ Removal complete")
