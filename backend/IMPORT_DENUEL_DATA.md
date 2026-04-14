# Denuel Academy Data Import Guide

This guide explains how to import student/client data from the old Denuel Academy PHP app into the new Academy App Django backend.

## Overview

The new Academy App has a more comprehensive `Client` model compared to the old app's simple `students` table. The import process maps the old data to the new structure:

### Field Mapping

| Old Database (students) | New Database (Client) | Mapping Logic |
|---|---|---|
| `id` | Not mapped | Old ID not stored (auto-increment in new DB) |
| `name` | `first_name`, `last_name` | Split on first space |
| `course` | `academy_class` | Match against existing AcademyClass titles |
| `status` | `status` | Direct mapping: active→active, inactive→inactive, etc. |
| `created_at` | `created_at` | Preserved if available, otherwise current time |
| N/A | `enrollment_date` | Set to current date or old `created_at` |
| N/A | `subscription_start` | Set to current date |
| N/A | `subscription_end` | Set to 1 year from start date |
| N/A | `plan` | Not assigned (no default plan) |
| N/A | `auto_renew` | Set to `True` |

---

## Setup

### 1. Install Dependencies

The import tools require `mysql-connector-python`. It's already added to `requirements.txt`:

```bash
cd backend
pip install -r requirements.txt
```

Or manually:
```bash
pip install mysql-connector-python==8.4.0
```

---

## Import Methods

### Method 1: Direct MySQL Database Import (Recommended)

If you have access to the old Denuel Academy MySQL database:

```bash
cd backend
python manage.py import_denuel_academy \
  --from-mysql \
  --host localhost \
  --user root \
  --password "your_db_password" \
  --db academy
```

**Parameters:**
- `--from-mysql`: Enable MySQL mode
- `--host`: MySQL server hostname (default: localhost)
- `--user`: MySQL username (default: root)
- `--password`: MySQL password (default: empty)
- `--db`: Database name (default: academy)

**Example with default credentials:**
```bash
python manage.py import_denuel_academy --from-mysql
```

---

### Method 2: Extract Then Import (Two-Step)

If the old database is on a different server or you want to backup data first:

#### Step 1: Extract Data to CSV

```bash
cd backend
python extract_denuel_data.py \
  --host 192.168.1.100 \
  --user denuel_admin \
  --password "secure_password" \
  --db academy \
  --output denuel_students.csv \
  --attendance denuel_attendance.csv
```

This creates two files:
- `denuel_students.csv` - Student records
- `denuel_attendance.csv` - Attendance records

#### Step 2: Import from CSV (Future Feature)

```bash
# Future: import from CSV (currently supports direct MySQL only)
python manage.py import_denuel_academy --from-csv denuel_students.csv
```

---

### Method 3: Using SQL Dump File

If you have a `Database.sql` file from the old app:

```bash
python manage.py import_denuel_academy --db-file /path/to/Database.sql
```

---

## Pre-Import Checklist

Before importing, ensure:

- [ ] Backend is running with migrations applied: `python manage.py migrate`
- [ ] At least one `Plan` exists (auto-created if missing)
- [ ] At least one `AcademyClass` exists (auto-created if missing)
- [ ] MySQL connector is installed: `pip install mysql-connector-python`
- [ ] Old database credentials are correct
- [ ] No duplicate clients exist in the current system (optional check)

---

## Running the Import

### Start Django Environment

```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python manage.py import_denuel_academy --from-mysql
```

### Output Example

```
Starting Denuel Academy import...
Found 45 students in old database
Created default class: Imported Students
  ✓ Imported: John Doe (1)
  ✓ Imported: Jane Smith (2)
  ✓ Imported: Ahmed Hassan (3)
  ✗ Skipped: Unknown Name (4) - Invalid name format
  ...

✓ Import complete!
  Total: 45
  Imported: 44
  Skipped: 1
```

---

## Handling Conflicts & Duplicates

### Checking for Duplicates

Before importing, check for existing clients with similar names:

```bash
python manage.py shell
```

```python
from apps.clients.models import Client

# Find potential duplicates
duplicates = Client.objects.values('first_name', 'last_name').annotate(
    count=Count('id')
).filter(count__gt=1)

for dup in duplicates:
    print(f"{dup['first_name']} {dup['last_name']} - {dup['count']} records")
```

### Cleaning Up Before Import

If you want to start fresh and remove all previously imported clients:

```bash
# CAUTION: This deletes ALL clients!
python manage.py import_denuel_academy --from-mysql --clean
```

When prompted, type `yes` to confirm deletion.

---

## Verifying the Import

### 1. Admin Panel Check

- Navigate to Django Admin: `http://localhost:8000/admin/clients/client/`
- Verify imported clients appear in the list
- Check that names, status, and dates are correct

### 2. API Check

```bash
# Get all clients
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/clients/

# Get specific client
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/clients/1/
```

### 3. Database Query

```bash
python manage.py shell
```

```python
from apps.clients.models import Client

# Count imported clients
print(f"Total clients: {Client.objects.count()}")

# List imported clients
for client in Client.objects.all():
    print(f"{client.full_name} - Status: {client.status}")
```

---

## Troubleshooting

### Error: "MySQL connection failed"

**Solution:**
- Verify credentials are correct
- Check if MySQL service is running
- Ensure the firewall allows connection to port 3306
- Try connecting manually: `mysql -h localhost -u root -p academy`

### Error: "No students found"

**Solution:**
- Verify the old database has data in the `students` table
- Check if table name is exactly `students` (case-sensitive on some systems)
- Run: `SELECT COUNT(*) FROM students;` in MySQL to verify

### Error: "Client already exists"

**Solution:**
- The import checks for duplicate names and skips them
- To re-import, either:
  - Clean up duplicates manually in Django Admin
  - Use `--clean` flag to remove all clients first (use with caution!)

### Error: "Plan/Class not found"

**Solution:**
- These are auto-created if missing
- Check Django Admin to verify they were created
- Manually create them if needed:

```bash
python manage.py shell
```

```python
from apps.plans.models import Plan
from apps.classes.models import AcademyClass

# Create plan
plan = Plan.objects.create(
    title='Basic Plan',
    price=50.00,
    duration_days=30,
    plan_type='subscription'
)

# Create class
cls = AcademyClass.objects.create(
    title='Beginner Level',
    level='Beginner',
    instructor='Admin',
    schedule='Mon, Wed, Fri'
)
```

---

## Post-Import Tasks

After successful import:

1. **Verify Data Integrity**
   - Check client details in admin panel
   - Verify enrollment dates and subscription periods
   - Ensure statuses are correct

2. **Update Plans & Classes**
   - Assign imported clients to correct classes
   - Update subscription plans as needed
   - Set appropriate renewal dates

3. **Handle Attendance Data**
   - If you extracted attendance CSV, create a separate import command
   - Map old attendance records to new system if needed
   - Consider archiving old records separately

4. **Update Frontend**
   - The Clients page will show all imported clients
   - Profiles can be viewed and edited normally
   - Create invoices, renewals, etc. as usual

---

## Rollback (If Needed)

If the import didn't go as expected:

### Option 1: Delete and Re-import

```bash
python manage.py shell
```

```python
from apps.clients.models import Client

# Delete all imported clients
Client.objects.filter(
    created_at__year=2026  # Adjust year as needed
).delete()
```

Then re-run the import command.

### Option 2: Restore from Backup

If you have a database backup:

```bash
# Restore from backup (before import)
python manage.py loaddata backup_before_import.json
```

---

## Advanced: Custom Data Processing

If you need special handling for certain fields, modify the import command:

**File:** `backend/apps/clients/management/commands/import_denuel_academy.py`

Example: Map course names to different classes:

```python
def import_student_as_client(self, student_data, default_plan, default_class):
    # ... existing code ...
    
    # Custom course mapping
    course = student_data.get('course', '')
    course_mapping = {
        'Football': 'Football Class',
        'Basketball': 'Basketball Class',
        'Volleyball': 'Volleyball Class',
    }
    
    academy_class = default_class
    if course in course_mapping:
        try:
            academy_class = AcademyClass.objects.get(
                title=course_mapping[course]
            )
        except AcademyClass.DoesNotExist:
            pass
    
    # ... rest of code ...
```

---

## Need Help?

For issues or questions:

1. Check the troubleshooting section above
2. Verify all credentials and database access
3. Check Django logs: `python manage.py runserver` (verbose output)
4. Review import command output for specific error messages

---

## Summary

| Stage | Command | Time |
|---|---|---|
| Setup | `pip install -r requirements.txt` | 1-2 min |
| Migration | `python manage.py migrate` | < 1 min |
| Import | `python manage.py import_denuel_academy --from-mysql` | 2-5 min |
| Verify | Check admin panel & API | 5-10 min |
| **Total** | | **8-20 min** |

---

**Last Updated:** April 14, 2026
