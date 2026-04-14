# Quick Reference: Import Denuel Academy Students

## TL;DR - Fast Import

```bash
cd backend
python manage.py import_denuel_academy --from-mysql --host localhost --user root --password "your_password" --db academy
```

## What Gets Imported?

✅ **Student names** → Split into first_name + last_name
✅ **Course** → Linked to AcademyClass
✅ **Status** → Preserved (active/inactive/pending)
✅ **Created date** → Used as enrollment_date

✨ **Auto-Created:**

- Default Class: "Imported Students"
- 1-year subscription period
- All statuses set to active

## Files Added

```
backend/
├── apps/clients/management/
│   ├── __init__.py
│   └── commands/
│       ├── __init__.py
│       └── import_denuel_academy.py  ← Main import command
├── extract_denuel_data.py             ← Extract to CSV
├── IMPORT_DENUEL_DATA.md              ← Full guide
└── requirements.txt                   ← Updated with mysql-connector
```

## 3-Step Import Process

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run Migrations
```bash
python manage.py migrate
```

### Step 3: Import Data
```bash
# Option A: From MySQL (if DB is accessible)
python manage.py import_denuel_academy --from-mysql

# Option B: Extract to CSV first
python extract_denuel_data.py --host <ip> --user <user> --password <pass> --db academy
```

## Verify Import

```bash
# Check in admin
open http://localhost:8000/admin/clients/client/

# Or via API
curl http://localhost:8000/api/clients/ -H "Authorization: Bearer TOKEN"

# Or Django shell
python manage.py shell
>>> from apps.clients.models import Client
>>> Client.objects.count()
```

## Field Mapping

```
OLD → NEW
id → (not mapped, new auto-increment)
name → first_name + last_name
course → academy_class
status → status
created_at → created_at + enrollment_date
(new) → subscription_start (today)
(new) → subscription_end (today + 1 year)
(new) → plan (default)
(new) → auto_renew (True)
```

## Troubleshooting

| Problem | Solution |
|---|---|
| "MySQL connection failed" | Check host, user, password credentials |
| "No students found" | Verify students table exists in old DB |
| "Client already exists" | Use `--clean` flag or manually delete duplicates |
| Import is slow | Normal for 100+ students, be patient |

## Advanced Options

```bash
# Check for duplicates before importing
python manage.py shell
>>> from apps.clients.models import Client
>>> dup = Client.objects.values('first_name', 'last_name').annotate(count=1).filter(count__gt=1)

# Clean all clients before fresh import (⚠️ CAUTION)
python manage.py import_denuel_academy --from-mysql --clean

# Import from SQL dump file
python manage.py import_denuel_academy --db-file /path/to/Database.sql
```

## What's Different from Old App?

Old Denuel Academy was simple:
- Students table with: id, name, course, status

New Academy App is comprehensive:
- Clients with: name parts, DOB, gender, phone, email, address
- Plans & subscriptions (auto-renewal support)
- Class enrollment
- Attendance tracking
- Invoice/payment history
- Emergency contacts

Import maps basic data to new structure and provides sensible defaults.

## Next Steps After Import

1. ✅ Log in: `http://localhost:3000/login`
2. ✅ View importing clients: Clients page
3. ✅ Update plans: Assign correct pricing plans
4. ✅ Update classes: Reassign to actual classes
5. ✅ Fill profiles: Add missing contact info in admin

---

For detailed troubleshooting and examples, see: **IMPORT_DENUEL_DATA.md**
