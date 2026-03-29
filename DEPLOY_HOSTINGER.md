# Hostinger Deployment Guide (Frontend + Backend + Database)

This guide prepares the app for a Hostinger VPS deployment using:
- Django backend (Gunicorn)
- React frontend (static build served by Nginx)
- MySQL database (Hostinger MySQL or VPS MySQL)

## 1) Server Prerequisites

Run on your Hostinger VPS:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx mysql-client git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
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

## 5) Frontend Build

```bash
cd /var/www/academy-app/frontend
npm install
cp .env.production.example .env.production
# Keep REACT_APP_API_BASE_URL=/api for same-domain reverse proxy
npm run build
```

## 6) Nginx Reverse Proxy + Static Hosting

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
cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

## 10) Health Checks

- Backend: `http://127.0.0.1:8000/api/` from VPS
- Public app: `https://denuelacademy.com`
- Admin: `https://denuelacademy.com/admin/`
- API through Nginx: `https://denuelacademy.com/api/`
