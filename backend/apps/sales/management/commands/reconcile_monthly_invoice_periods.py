from calendar import monthrange
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.sales.models import Invoice


class Command(BaseCommand):
    help = (
        "Reconcile monthly invoice periods by reassigning duplicate months to missing months "
        "and creating invoices for remaining missing periods."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist changes. Without this flag, command runs in dry-run mode.",
        )

    @staticmethod
    def _month_start(d):
        return date(d.year, d.month, 1)

    @staticmethod
    def _month_end(d):
        return date(d.year, d.month, monthrange(d.year, d.month)[1])

    @classmethod
    def _iter_months(cls, start_month, end_month):
        cur = date(start_month.year, start_month.month, 1)
        while cur <= end_month:
            yield cur
            y = cur.year + (cur.month // 12)
            m = 1 if cur.month == 12 else cur.month + 1
            cur = date(y, m, 1)

    @staticmethod
    def _month_key(d):
        return f"{d.year:04d}-{d.month:02d}"

    def handle(self, *args, **options):
        apply_changes = options["apply"]

        qs = (
            Invoice.objects.select_related("client", "plan")
            .exclude(status="cancelled")
            .filter(plan__duration="month", due_date__isnull=False)
            .order_by("client_id", "plan_id", "due_date", "created_at", "id")
        )

        groups = {}
        for inv in qs:
            key = (inv.client_id, inv.plan_id)
            groups.setdefault(key, []).append(inv)

        summary_scanned = 0
        summary_reassigned = 0
        summary_created = 0

        mode = "APPLY" if apply_changes else "DRY-RUN"
        self.stdout.write(self.style.NOTICE(f"Mode: {mode}"))

        for (client_id, plan_id), invoices in groups.items():
            summary_scanned += len(invoices)

            # Bucket by month key of due_date.
            bucket = {}
            for inv in invoices:
                mk = self._month_key(inv.due_date)
                bucket.setdefault(mk, []).append(inv)

            month_starts = [self._month_start(inv.due_date) for inv in invoices]
            span_start = min(month_starts)
            span_end = max(month_starts)
            expected_keys = [self._month_key(m) for m in self._iter_months(span_start, span_end)]
            existing_keys = set(bucket.keys())
            missing_keys = [k for k in expected_keys if k not in existing_keys]

            # Gather extras from duplicated months (keep oldest, move newer duplicates).
            extras = []
            for mk, invs in bucket.items():
                if len(invs) <= 1:
                    continue
                invs_sorted = sorted(invs, key=lambda x: (x.created_at, x.id))
                extras.extend(invs_sorted[1:])

            if not extras and not missing_keys:
                continue

            client_name = str(invoices[0].client)
            plan_name = invoices[0].plan.name if invoices[0].plan else "-"
            self.stdout.write(
                self.style.WARNING(
                    f"Client {client_id} | {client_name} | Plan {plan_name} | "
                    f"extras={len(extras)} missing={len(missing_keys)}"
                )
            )

            # 1) Reassign duplicate invoices into missing months.
            extras_sorted = sorted(extras, key=lambda x: (x.created_at, x.id))
            reassign_pairs = list(zip(extras_sorted, missing_keys))
            for inv, mk in reassign_pairs:
                year, month = map(int, mk.split("-"))
                new_start = date(year, month, 1)
                new_end = date(year, month, monthrange(year, month)[1])

                self.stdout.write(
                    f"  REASSIGN Invoice #{inv.id} {inv.invoice_number}: "
                    f"{inv.issue_date}..{inv.due_date} -> {new_start}..{new_end}"
                )

                if apply_changes:
                    inv.issue_date = new_start
                    inv.due_date = new_end
                    inv.save(update_fields=["issue_date", "due_date", "updated_at"])
                summary_reassigned += 1

            # 1b) If duplicates remain but there are no in-span missing months,
            # backfill into months before the earliest month (e.g. duplicate March -> September).
            unmatched_extras = extras_sorted[len(reassign_pairs):]
            if unmatched_extras:
                first_month = span_start
                backfill_months = []
                cur = first_month
                for _ in unmatched_extras:
                    y = cur.year - 1 if cur.month == 1 else cur.year
                    m = 12 if cur.month == 1 else cur.month - 1
                    cur = date(y, m, 1)
                    backfill_months.append(cur)

                for inv, month_start in zip(unmatched_extras, backfill_months):
                    new_start = month_start
                    new_end = date(new_start.year, new_start.month, monthrange(new_start.year, new_start.month)[1])

                    self.stdout.write(
                        f"  REASSIGN-BACKFILL Invoice #{inv.id} {inv.invoice_number}: "
                        f"{inv.issue_date}..{inv.due_date} -> {new_start}..{new_end}"
                    )

                    if apply_changes:
                        inv.issue_date = new_start
                        inv.due_date = new_end
                        inv.save(update_fields=["issue_date", "due_date", "updated_at"])
                    summary_reassigned += 1

            # 2) Create missing invoices that still remain after reassignment.
            used_missing = {mk for _, mk in reassign_pairs}
            remaining_missing = [mk for mk in missing_keys if mk not in used_missing]

            if not remaining_missing:
                continue

            template = sorted(invoices, key=lambda x: (x.created_at, x.id))[-1]
            for mk in remaining_missing:
                year, month = map(int, mk.split("-"))
                issue_date = date(year, month, 1)
                due_date = date(year, month, monthrange(year, month)[1])
                status = template.status if template.status in {"draft", "sent", "partial", "overdue"} else "sent"

                self.stdout.write(
                    f"  CREATE missing month {mk}: {issue_date}..{due_date} "
                    f"from template invoice #{template.id}"
                )

                if apply_changes:
                    with transaction.atomic():
                        Invoice.objects.create(
                            client=template.client,
                            plan=template.plan,
                            amount=template.amount,
                            currency=template.currency,
                            tax_rate=template.tax_rate,
                            issue_date=issue_date,
                            due_date=due_date,
                            status=status,
                            notes=(template.notes or "") + " | Auto-generated to fill missing monthly period",
                        )
                summary_created += 1

        self.stdout.write(self.style.NOTICE(f"Scanned monthly invoices: {summary_scanned}"))
        self.stdout.write(self.style.NOTICE(f"Reassigned duplicates: {summary_reassigned}"))
        self.stdout.write(self.style.NOTICE(f"Created missing invoices: {summary_created}"))

        if apply_changes:
            self.stdout.write(self.style.SUCCESS("Monthly invoice period reconciliation complete."))
        else:
            self.stdout.write(self.style.WARNING("Dry-run only. Re-run with --apply to persist changes."))
