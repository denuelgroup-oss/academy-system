# Hostinger Deployment Guide (Frontend + Backend + Database)

This guide prepares the app for Hostinger deployment using:
- Django backend (Gunicorn)
- React frontend (static build served by Nginx)
- MySQL database (Hostinger MySQL or VPS MySQL)

If Hostinger does not support Node.js in your hosting plan, build the frontend locally and upload only the static `build/` files. Node.js is only needed at build time, not runtime.

## 1) Server Prerequisites

Run on your Hostinger VPS:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx mysql-client git
```

## 2) Project Upload

Clone or upload the project to a path like:

```bash
/var/www/academy-app
```

## 3) Backend Setup

```bash
cd /var/www/academy-app/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create backend environment file:

```bash
cp .env.example .env
```

Set production values in `.env`:
- `DEBUG=False`
- `SECRET_KEY=<strong-random-secret>`
- `ALLOWED_HOSTS=denuelacademy.com,www.denuelacademy.com,api.denuelacademy.com`
- `DB_ENGINE=mysql`
- `DB_NAME=<hostinger_db_name>`
- `DB_USER=<hostinger_db_user>`
- `DB_PASSWORD=<hostinger_db_password>`
- `DB_HOST=<hostinger_mysql_host>`
- `DB_PORT=3306`
- `CORS_ALLOWED_ORIGINS=https://denuelacademy.com,https://www.denuelacademy.com`
- `CSRF_TRUSTED_ORIGINS=https://denuelacademy.com,https://www.denuelacademy.com,https://api.denuelacademy.com`

Run migrations and collect static:

```bash
source .venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

## 4) Gunicorn Service (Backend)

Create `/etc/systemd/system/academy-backend.service`:

```ini
[Unit]
Description=Academy Django Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/academy-app/backend
Environment="PATH=/var/www/academy-app/backend/.venv/bin"
ExecStart=/var/www/academy-app/backend/.venv/bin/gunicorn academypro.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable/start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable academy-backend
sudo systemctl start academy-backend
sudo systemctl status academy-backend
```

## 5) Frontend Build (No Node on Hostinger)

Build on your local computer:

```bash
cd C:/Users/Administrateur/Academy\ App/frontend
npm install
# If backend is on same domain via reverse proxy:
# REACT_APP_API_BASE_URL=/api
# If backend is on api subdomain:
# REACT_APP_API_BASE_URL=https://api.denuelacademy.com/api
npm run build
```

Upload the generated `frontend/build/` content to the server path below (or shared hosting `public_html`).

If using Apache shared hosting, include `.htaccess` (already added in `frontend/public/.htaccess`) so React routes work.

## 6) Nginx Reverse Proxy + Static Hosting (VPS)

```bash
cd /var/www/academy-app/frontend
npm install
cp .env.production.example .env.production
# Keep REACT_APP_API_BASE_URL=/api for same-domain reverse proxy
npm run build
```

Create `/etc/nginx/sites-available/academy`:

```nginx
server {
    listen 80;
    server_name denuelacademy.com www.denuelacademy.com;

    root /var/www/academy-app/frontend/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        proxy_pass http://127.0.0.1:8000/media/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/academy-app/backend/staticfiles/;
    }
}
```

Enable Nginx site:

```bash
sudo ln -s /etc/nginx/sites-available/academy /etc/nginx/sites-enabled/academy
sudo nginx -t
sudo systemctl restart nginx
```

## 7) SSL (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d denuelacademy.com -d www.denuelacademy.com
```

## 8) Database Readiness Checklist

- Create MySQL database/user in Hostinger panel
- Whitelist VPS IP (if required by Hostinger DB firewall)
- Confirm remote connectivity from VPS:

```bash
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME>
```

## 9) Update Deployment

```bash
cd /var/www/academy-app
git pull
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart academy-backend
# Frontend: rebuild locally, then upload updated build/ files
sudo systemctl reload nginx
```

## 10) Health Checks

- Backend: `http://127.0.0.1:8000/api/` from VPS
- Public app: `https://denuelacademy.com`
- Admin: `https://denuelacademy.com/admin/`
- API through Nginx: `https://denuelacademy.com/api/`
