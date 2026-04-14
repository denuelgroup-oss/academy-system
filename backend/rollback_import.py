dddddddddddddddddddddddddddddddddimport os
import django
from datetime import date

# Setup Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from django.db import transaction
from apps.clients.models import Client
from apps.sales.models import Invoice
from apps.classes.models import AcademyClass
from apps.plans.models import Plan


INVOICE_NOTE_TAG = "CSV_PENDING_IMPORT"


def rollback_import():
    """Rollback the import operation"""
    
    with transaction.atomic():
        # Step 1: Delete invoices created from import
        print("Deleting imported invoices...")
        invoices = Invoice.objects.filter(notes__contains=INVOICE_NOTE_TAG)
        invoice_count = invoices.count()
        invoices.delete()
        print(f"  Deleted {invoice_count} invoices")
        
        # Step 2: Delete clients created from import (those with "Imported pending amount" in notes)
        print("\nDeleting imported clients...")
        clients = Client.objects.filter(notes__contains="Imported pending amount")
        client_count = clients.count()
        clients.delete()
        print(f"  Deleted {client_count} clients")
        
        # Step 3: Delete auto-created classes and plans
        print("\nDeleting auto-created classes...")
        classes = AcademyClass.objects.filter(description="Auto-created from CSV client import")
        class_count = classes.count()
        classes.delete()
        print(f"  Deleted {class_count} classes")
        
        print("\nDeleting auto-created plans...")
        plans = Plan.objects.filter(description="Auto-created from CSV client import")
        plan_count = plans.count()
        plans.delete()
        print(f"  Deleted {plan_count} plans")
    
    print("\n=== Rollback Complete ===")
    print(f"Summary:")
    print(f"  - Invoices deleted: {invoice_count}")
    print(f"  - Clients deleted: {client_count}")
    print(f"  - Classes deleted: {class_count}")
    print(f"  - Plans deleted: {plan_count}")


if __name__ == "__main__":
    confirm = input("Are you sure you want to rollback the import? (yes/no): ")
    if confirm.lower() == "yes":
        rollback_import()
    else:
        print("Rollback cancelled.")
