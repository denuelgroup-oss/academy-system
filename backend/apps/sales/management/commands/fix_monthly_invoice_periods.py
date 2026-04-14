from calendar import monthrange
from datetime import date

from django.core.management.base import BaseCommand

from apps.sales.models import Invoice


class Command(BaseCommand):
    help = "Normalize monthly plan invoice periods to calendar-month boundaries."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist changes. Without this flag, command runs in dry-run mode.",
        )

    @staticmethod
    def _expected_period_from_due(due_date, duration_value):
        months = max(1, int(duration_value or 1))

        end_day = monthrange(due_date.year, due_date.month)[1]
        expected_end = date(due_date.year, due_date.month, end_day)

        end_month_start = date(due_date.year, due_date.month, 1)
        start_month_index = (end_month_start.month - 1) - (months - 1)
        start_year = end_month_start.year + (start_month_index // 12)
        start_month = (start_month_index % 12) + 1
        expected_start = date(start_year, start_month, 1)

        return expected_start, expected_end

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        monthly_qs = (
            Invoice.objects.select_related("client", "plan")
            .filter(plan__duration="month")
            .exclude(due_date__isnull=True)
            .order_by("id")
        )

        changed = []
        for inv in monthly_qs:
            expected_start, expected_end = self._expected_period_from_due(
                inv.due_date,
                getattr(inv.plan, "duration_value", 1),
            )

            issue_date = inv.issue_date
            due_date = inv.due_date
            needs_fix = issue_date != expected_start or due_date != expected_end
            if not needs_fix:
                continue

            changed.append(
                {
                    "id": inv.id,
                    "client": str(inv.client),
                    "plan": inv.plan.name if inv.plan else "-",
                    "old_issue": issue_date,
                    "old_due": due_date,
                    "new_issue": expected_start,
                    "new_due": expected_end,
                }
            )

            if apply_changes:
                inv.issue_date = expected_start
                inv.due_date = expected_end
                inv.save(update_fields=["issue_date", "due_date", "updated_at"])

        mode = "APPLY" if apply_changes else "DRY-RUN"
        self.stdout.write(self.style.NOTICE(f"Mode: {mode}"))
        self.stdout.write(self.style.NOTICE(f"Monthly invoices scanned: {monthly_qs.count()}"))
        self.stdout.write(self.style.NOTICE(f"Invoices requiring normalization: {len(changed)}"))

        if changed:
            for row in changed:
                self.stdout.write(
                    f"Invoice #{row['id']} | {row['client']} | {row['plan']} | "
                    f"{row['old_issue']}..{row['old_due']} -> {row['new_issue']}..{row['new_due']}"
                )

        if apply_changes:
            self.stdout.write(self.style.SUCCESS(f"Updated {len(changed)} invoice(s)."))
        else:
            self.stdout.write(self.style.WARNING("No data changed. Re-run with --apply to persist."))
