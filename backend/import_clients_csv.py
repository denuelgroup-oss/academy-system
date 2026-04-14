import csv
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


def setup_django():
    import os
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
    django.setup()


def import_clients(csv_path):
    from django.db import transaction
    from apps.classes.models import AcademyClass
    from apps.clients.models import Client
    from apps.plans.models import Plan
    from apps.sales.models import Invoice


PLACEHOLDER_PHONES = {"", "1234567890"}
INVOICE_NOTE_TAG = "CSV_PENDING_IMPORT"


def parse_date(raw):
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def split_name(full_name):
    parts = [p for p in (full_name or "").strip().split() if p]
    if not parts:
        return "Unknown", "Client"
    if len(parts) == 1:
        return parts[0].title(), "-"
    return parts[0].title(), " ".join(parts[1:]).title()


def get_or_create_subscription_plan(name):
    plan = Plan.objects.filter(name__iexact=name.strip(), plan_type="subscription").first()
    if plan:
        return plan, False
    plan = Plan.objects.create(
        name=name.strip(),
        plan_type="subscription",
        description="Auto-created from CSV client import",
        price=Decimal("0.00"),
        currency="USD",
        duration="month",
        duration_value=1,
        features="",
        auto_renew_clients=False,
        max_sessions_per_week=0,
        is_active=True,
    )
    return plan, True


def parse_amount(raw):
    text = (raw or "").strip()
    if not text:
        return Decimal("0")
    try:
        return Decimal(text)
    except Exception:
        return Decimal("0")


def import_clients(csv_path):
    created = 0
    updated = 0
    skipped = 0
    classes_created = 0
    plans_created = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    with transaction.atomic():
        for row in rows:
            full_name = (row.get("Name") or "").strip()
            if not full_name:
                skipped += 1
                continue

            phone = (row.get("Mobile") or "").strip()
            dob = parse_date(row.get("DOB"))
            doj = parse_date(row.get("DOJ"))
            sub_start = parse_date(row.get("Start date"))
            sub_end = parse_date(row.get("End date"))
            abonnement = (row.get("Abonnement") or "").strip()
            pending_amount = (row.get("Pending Amount") or "").strip()

            first_name, last_name = split_name(full_name)

            academy_class = None
            if abonnement:
                academy_class, class_created = AcademyClass.objects.get_or_create(
                    name=abonnement,
                    defaults={
                        "description": "Auto-created from CSV client import",
                        "is_active": True,
                    },
                )
                if class_created:
                    classes_created += 1

            plan = None
            if abonnement:
                plan, plan_created = get_or_create_subscription_plan(abonnement)
                if plan_created:
                    plans_created += 1

            status = "active"
            if sub_end and sub_end < date.today():
                status = "expired"

            notes = ""
            if pending_amount:
                notes = f"Imported pending amount: {pending_amount}"

            base_qs = Client.objects.filter(
                first_name__iexact=first_name,
                last_name__iexact=last_name,
            )

            if phone and phone not in PLACEHOLDER_PHONES:
                client = base_qs.filter(phone=phone).first() or base_qs.first()
            else:
                client = base_qs.first()

            if client is None:
                client = Client(
                    first_name=first_name,
                    last_name=last_name,
                )
                created += 1
            else:
                updated += 1

            client.phone = phone
            client.date_of_birth = dob
            client.enrollment_date = doj or sub_start or client.enrollment_date or date.today()
            client.subscription_start = sub_start
            client.subscription_end = sub_end
            client.status = status
            client.plan = plan
            client.academy_class = academy_class
            if notes:
                client.notes = notes
            client.save()

    return {
        "rows": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "classes_created": classes_created,
        "plans_created": plans_created,
    }


def import_pending_invoices(csv_path):
    from django.db import transaction
    from apps.clients.models import Client
    from apps.plans.models import Plan
    from apps.sales.models import Invoice
    
    created = 0
    skipped = 0
    missing_clients = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    with transaction.atomic():
        for row in rows:
            full_name = (row.get("Name") or "").strip()
            if not full_name:
                skipped += 1
                continue

            pending_amount = parse_amount(row.get("Pending Amount"))
            if pending_amount <= 0:
                skipped += 1
                continue

            phone = (row.get("Mobile") or "").strip()
            sub_start = parse_date(row.get("Start date")) or date.today()
            sub_end = parse_date(row.get("End date")) or sub_start
            abonnement = (row.get("Abonnement") or "").strip()

            first_name, last_name = split_name(full_name)
            base_qs = Client.objects.filter(
                first_name__iexact=first_name,
                last_name__iexact=last_name,
            )
            if phone and phone not in PLACEHOLDER_PHONES:
                client = base_qs.filter(phone=phone).first() or base_qs.first()
            else:
                client = base_qs.first()

            if not client:
                missing_clients += 1
                continue

            plan = client.plan
            if not plan and abonnement:
                plan = Plan.objects.filter(name__iexact=abonnement, plan_type="subscription").first()

            existing = Invoice.objects.filter(
                client=client,
                amount=pending_amount,
                issue_date=sub_start,
                due_date=sub_end,
                notes__contains=INVOICE_NOTE_TAG,
            ).exists()
            if existing:
                skipped += 1
                continue

            status = "overdue" if sub_end < date.today() else "sent"
            Invoice.objects.create(
                client=client,
                plan=plan,
                amount=pending_amount,
                currency="USD",
                tax_rate=Decimal("0"),
                issue_date=sub_start,
                due_date=sub_end,
                status=status,
                notes=f"{INVOICE_NOTE_TAG}: Imported from {csv_path.name}",
            )
            created += 1

    return {
        "rows": len(rows),
        "created": created,
        "skipped": skipped,
        "missing_clients": missing_clients,
    }


if __name__ == "__main__":
    setup_django()
    
    csv_file = Path(r"c:\Users\Administrateur\Academy App\import data\20260322_103427_Spyn-data_.csv")
    if not csv_file.exists():
        raise SystemExit(f"CSV file not found: {csv_file}")

    result = import_clients(csv_file)
    print("IMPORT_CLIENTS_RESULT", result)
    invoices_result = import_pending_invoices(csv_file)
    print("IMPORT_INVOICES_RESULT", invoices_result)