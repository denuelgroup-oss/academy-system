// Hostinger shared hosting path: ~/academy-backend
// Adjust HOME_DIR to your actual Hostinger home path (shown in hPanel File Manager)
const HOME_DIR = process.env.HOME || '/home/u123456789';
const APP_DIR = `${HOME_DIR}/academy-backend`;

module.exports = {
  apps: [
    {
      name: "academy-backend",
      cwd: APP_DIR,
      script: `${APP_DIR}/.venv/bin/gunicorn`,
      args: `academypro.wsgi:application --bind 0.0.0.0:${process.env.PORT || 8000} --workers 2 --timeout 120`,
      interpreter: "none",
      env: {
        DJANGO_SETTINGS_MODULE: "academypro.settings"
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true
    }
  ]
};
