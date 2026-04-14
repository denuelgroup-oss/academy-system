"""
Import students/clients from old Denuel Academy PHP app to new Academy App Django backend.
This command reads from the old Denuel Academy Database.sql and imports students as clients.

Usage:
    python manage.py import_denuel_academy --db-file path/to/Database.sql
    python manage.py import_denuel_academy --from-mysql --host localhost --user root --password pass --db academy
"""

import os
import sys
import mysql.connector
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.clients.models import Client
from apps.plans.models import Plan
from apps.classes.models import AcademyClass
from datetime import timedelta


class Command(BaseCommand):
    help = 'Import students/clients from old Denuel Academy app'

    def add_arguments(self, parser):
        parser.add_argument(
            '--from-mysql',
            action='store_true',
            help='Import directly from old MySQL database'
        )
        parser.add_argument(
            '--host',
            type=str,
            default='localhost',
            help='MySQL host (default: localhost)'
        )
        parser.add_argument(
            '--user',
            type=str,
            default='root',
            help='MySQL user (default: root)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='',
            help='MySQL password'
        )
        parser.add_argument(
            '--db',
            type=str,
            default='academy',
            help='MySQL database name (default: academy)'
        )
        parser.add_argument(
            '--db-file',
            type=str,
            help='Path to Database.sql file to import from'
        )
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Remove all imported clients before import (use with caution)'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting Denuel Academy import...'))

        # Clean existing clients if requested
        if options['clean']:
            confirm = input('Are you sure you want to delete ALL clients? (yes/no): ')
            if confirm.lower() == 'yes':
                Client.objects.all().delete()
                self.stdout.write(self.style.SUCCESS('All clients deleted.'))
            else:
                self.stdout.write('Skipping cleanup.')

        # Import from MySQL or CSV
        if options['from_mysql']:
            self.import_from_mysql(options)
        elif options['db_file']:
            self.import_from_sql_file(options['db_file'])
        else:
            self.stdout.write(
                self.style.WARNING(
                    'Please provide either --from-mysql or --db-file option'
                )
            )

    def import_from_mysql(self, options):
        """Import directly from the old MySQL database."""
        try:
            conn = mysql.connector.connect(
                host=options['host'],
                user=options['user'],
                password=options['password'],
                database=options['db']
            )
            cursor = conn.cursor(dictionary=True)

            # Fetch students from old database
            cursor.execute('SELECT id, name, course, status FROM students')
            students = cursor.fetchall()

            self.stdout.write(
                self.style.SUCCESS(f'Found {len(students)} students in old database')
            )

            # Get default plan and class
            default_plan = self.get_or_create_default_plan()
            default_class = self.get_or_create_default_class()

            imported_count = 0
            skipped_count = 0

            for student in students:
                try:
                    client = self.import_student_as_client(
                        student, default_plan, default_class
                    )
                    imported_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✓ Imported: {student["name"]} ({student.get("id")})'
                        )
                    )
                except Exception as e:
                    skipped_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'  ✗ Skipped: {student.get("name", "Unknown")} - {str(e)}'
                        )
                    )

            cursor.close()
            conn.close()

            self.print_summary(imported_count, skipped_count)

        except mysql.connector.Error as err:
            raise CommandError(f'MySQL connection error: {err}')

    def import_from_sql_file(self, db_file):
        """Parse Database.sql and extract student data."""
        if not os.path.exists(db_file):
            raise CommandError(f'File not found: {db_file}')

        self.stdout.write(f'Reading {db_file}...')

        # For now, just read and display the SQL structure
        with open(db_file, 'r') as f:
            content = f.read()

        # Parse INSERT statements if they exist
        if 'INSERT INTO students' in content:
            self.parse_sql_inserts(content)
        else:
            self.stdout.write(
                self.style.WARNING(
                    'No student data INSERT statements found in SQL file. '
                    'Use --from-mysql to import from an active database.'
                )
            )

    def parse_sql_inserts(self, sql_content):
        """Extract INSERT statements from SQL."""
        # This is a basic parser - in production you'd use a proper SQL parser
        import re

        # Find all INSERT INTO students statements
        pattern = r"INSERT INTO students \((.*?)\) VALUES \((.*?)\)"
        matches = re.findall(pattern, sql_content, re.IGNORECASE)

        if not matches:
            self.stdout.write(self.style.WARNING('No student INSERT statements found'))
            return

        default_plan = self.get_or_create_default_plan()
        default_class = self.get_or_create_default_class()

        imported_count = 0
        for columns, values in matches:
            try:
                # Parse column names and values
                col_list = [c.strip() for c in columns.split(',')]
                val_list = [v.strip().strip("'") for v in values.split(',')]

                if len(col_list) != len(val_list):
                    continue

                student_data = dict(zip(col_list, val_list))

                # Map old fields to new Client
                first_name = student_data.get('name', 'Unknown').split()[0]
                last_name = ' '.join(student_data.get('name', 'Unknown').split()[1:]) or 'Student'

                client, created = Client.objects.get_or_create(
                    first_name=first_name,
                    last_name=last_name,
                    defaults={
                        'plan': default_plan,
                        'academy_class': default_class,
                        'status': student_data.get('status', 'active'),
                        'enrollment_date': timezone.now().date(),
                    }
                )

                if created:
                    imported_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✓ {first_name} {last_name}')
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  Error parsing: {str(e)}')
                )

        self.print_summary(imported_count, 0)

    def import_student_as_client(self, student_data, default_plan, default_class):
        """Convert old student to new Client."""
        # Parse name
        name_parts = student_data['name'].split()
        first_name = name_parts[0]
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else 'Student'

        # Map course to academy class if available
        course = student_data.get('course', '')
        academy_class = default_class

        if course:
            try:
                academy_class = AcademyClass.objects.get(title__icontains=course)
            except AcademyClass.DoesNotExist:
                academy_class = default_class

        # Map status
        old_status = student_data.get('status', 'active')
        status_map = {
            'active': 'active',
            'inactive': 'inactive',
            'pending': 'pending',
        }
        status = status_map.get(old_status, 'active')

        # Check if student already exists
        existing = Client.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name
        ).first()

        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f'  Client "{first_name} {last_name}" already exists, skipping'
                )
            )
            return existing

        # Create new client
        client = Client.objects.create(
            first_name=first_name,
            last_name=last_name,
            plan=default_plan,
            academy_class=academy_class,
            status=status,
            enrollment_date=timezone.now().date(),
            subscription_start=timezone.now().date(),
            subscription_end=(timezone.now() + timedelta(days=365)).date(),
            auto_renew=True,
        )

        return client

    def get_or_create_default_plan(self):
        """Get or create a default plan for imported clients."""
        plan, created = Plan.objects.get_or_create(
            title='Imported - Basic',
            defaults={
                'description': 'Default plan for imported students from Denuel Academy',
                'price': 0.00,
                'duration_days': 365,
                'plan_type': 'subscription',
                'is_active': True,
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created default plan: {plan.title}')
            )
        return plan

    def get_or_create_default_class(self):
        """Get or create a default class for imported clients."""
        default_class, created = AcademyClass.objects.get_or_create(
            title='Imported Students',
            defaults={
                'level': 'Beginner',
                'schedule': 'Flexible',
                'instructor': 'Admin',
                'max_capacity': 100,
                'is_active': True,
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created default class: {default_class.title}')
            )
        return default_class

    def print_summary(self, imported, skipped):
        """Print import summary."""
        total = imported + skipped
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Import complete!\n'
                f'  Total: {total}\n'
                f'  Imported: {imported}\n'
                f'  Skipped: {skipped}'
            )
        )
