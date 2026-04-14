/**
 * Hostinger Node.js App Manager entry point.
 * Hostinger calls this file to start the application.
 * It spawns Gunicorn (Python/Django) on the PORT Hostinger injects.
 *
 * How to use:
 *   In hPanel → Advanced → Node.js → Create Application
 *   Application startup file: start_gunicorn.js
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 8000;
const VENV_GUNICORN = path.join(__dirname, '.venv', 'bin', 'gunicorn');

const proc = spawn(
  VENV_GUNICORN,
  [
    'academypro.wsgi:application',
    '--bind', `0.0.0.0:${PORT}`,
    '--workers', '2',
    '--timeout', '120'
  ],
  {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      DJANGO_SETTINGS_MODULE: 'academypro.settings'
    }
  }
);

proc.on('exit', (code) => {
  process.exit(code);
});
