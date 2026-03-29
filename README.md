# AcademyPRO — Football Academy Management System

A full-stack ERP-style management system for football academies built with **Django REST Framework** (backend) and **React 18** (frontend).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 6.0 + Django REST Framework |
| Auth | SimpleJWT (access 8h / refresh 7d) |
| Database | PostgreSQL 15 |
| Frontend | React 18 + React Router v6 |
| Charts | Recharts |
| Icons | react-icons |
| Containerization | Docker + Docker Compose |

---

## Modules

- **Academy**: Plans, Classes, Schedule, Clients, Attendance, Renewals
- **Sales**: Invoices, Received Payments, Pending Payments
- **Staff**: Staff Attendance, Users, Salary
- **Expenses**: Operational expense tracking with multi-currency
- **Reports**: Financial, Client, and Attendance analytics
- **Settings**: System config, Currencies, Exchange Rates

---

## Quick Start (Docker)

```bash
# 1. Clone / copy project to your machine
cd "Academy App"

# 2. Create backend environment file
cp backend/.env.example backend/.env
# Edit backend/.env and fill in SECRET_KEY, and any other values

# 3. Start all services
docker-compose up --build

# 4. Create a superuser (first time only)
docker-compose exec backend python manage.py createsuperuser

# 5. Open the app
#    Frontend:  http://localhost
#    API:       http://localhost:8000/api/
#    Admin:     http://localhost:8000/admin/
```

---

## Hostinger Deployment

For production deployment on Hostinger VPS (frontend + backend + MySQL), follow:

- `DEPLOY_HOSTINGER.md`

---

## Manual Setup (Development)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set SECRET_KEY, DB credentials, etc.

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
# API available at http://localhost:8000/api/
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
# App available at http://localhost:3000
```

---

## Environment Variables (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key | `your-secret-key-here` |
| `DEBUG` | Debug mode | `True` (dev) / `False` (prod) |
| `ALLOWED_HOSTS` | Allowed hostnames | `localhost,127.0.0.1` |
| `DB_NAME` | PostgreSQL database name | `academypro_db` |
| `DB_USER` | PostgreSQL user | `academypro_user` |
| `DB_PASSWORD` | PostgreSQL password | `your_password` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin | `http://localhost:3000` |

---

## API Endpoints

| Module | Base URL |
|---|---|
| Auth / Users | `/api/auth/` |
| Plans | `/api/plans/` |
| Classes + Schedules | `/api/classes/` |
| Clients | `/api/clients/` |
| Attendance | `/api/attendance/` |
| Invoices + Payments | `/api/sales/` |
| Staff Attendance + Salary | `/api/staff/` |
| Expenses | `/api/expenses/` |
| Reports | `/api/reports/` |
| Settings | `/api/settings/` |

### Key Custom Actions

| Endpoint | Description |
|---|---|
| `POST /api/auth/token/` | Login — returns access + refresh tokens |
| `POST /api/auth/token/refresh/` | Refresh access token |
| `GET /api/clients/expiring-soon/?days=30` | Clients expiring within N days |
| `GET /api/clients/expired/` | All expired clients |
| `POST /api/clients/refresh-statuses/` | Bulk update subscription statuses |
| `GET /api/attendance/by-date/?date=&academy_class=` | Students with attendance for a date |
| `POST /api/attendance/bulk-mark/` | Bulk mark attendance |
| `GET /api/sales/invoices/pending/` | All pending invoices |
| `GET /api/sales/invoices/overdue/` | All overdue invoices |
| `POST /api/sales/invoices/mark-overdue/` | Auto-mark past-due invoices as overdue |
| `GET /api/reports/dashboard/` | Dashboard KPIs |
| `GET /api/reports/financial/?year=2024` | Monthly financial breakdown |
| `GET /api/reports/clients/?year=2024` | Client analytics |
| `GET /api/reports/attendance/?year=2024&month=6` | Attendance analytics |

---

## Project Structure

```
Academy App/
├── backend/
│   ├── academypro/          # Django project config
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── authentication/  # Users, JWT, profiles
│   │   ├── plans/           # Subscription plans
│   │   ├── classes/         # Academy classes + schedules
│   │   ├── clients/         # Client management
│   │   ├── attendance/      # Client attendance
│   │   ├── sales/           # Invoices + payments
│   │   ├── staff/           # Staff attendance + salary
│   │   ├── expenses/        # Expense tracking
│   │   ├── reports/         # Analytics endpoints
│   │   └── settings_app/    # System settings, currencies
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios instance with JWT interceptors
│   │   ├── context/         # Auth context
│   │   ├── components/      # Layout + common components
│   │   └── pages/           # All page components
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## Default Login

After running `createsuperuser`, log in with those credentials at `/login`.

The superuser automatically gets role `admin` via the UserProfile signal.

---

## License

MIT — free to use and modify for your academy.
