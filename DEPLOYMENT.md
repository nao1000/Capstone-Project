# Production Deployment Guide: Django + PostgreSQL + Gunicorn + Nginx

## 0. Prerequisites & Workflow
* **Local Development:** Code is written locally using SQLite and `DEBUG = True`. Changes are committed and pushed to GitHub. Do **not** delete migration files; commit them to Git.
* **Server Access:** Must be connected to the UofA Campus VPN (`vpn.arizona.edu`, *not* the HPC VPN) to access the VM.
* **Server Environment:** Ubuntu Linux VM (`oswald1.cs.arizona.edu`). Code is pulled down from GitHub to `/home/nathanoswald1/coorda/scheduler`.

## 1. Environment Variables (`.env`)
To keep secrets safe and separate from the local environment, a `.env` file was created on the VM at `/home/nathanoswald1/coorda/scheduler/.env`:

```ini
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=oswald1.cs.arizona.edu,10.x.x.x # (Optional: Include IP if accessing directly)
DB_NAME=coorda_db
DB_USER=coorda_user
DB_PASSWORD=Your!Super#Secure$Password
DB_HOST=127.0.0.1
DB_PORT=5432
```

## 2. Hybrid `settings.py`
The `settings.py` was updated with the `python-dotenv` package to conditionally load settings. 
* If `.env` exists (Production), it uses PostgreSQL, loads the secure `SECRET_KEY`, sets `DEBUG = False`, and applies `ALLOWED_HOSTS`. 
* If `.env` is missing (Local), it falls back to SQLite, `DEBUG = True`, and a local secret key.
* `STATIC_ROOT = BASE_DIR / 'static'` was added to handle production static files.

## 3. PostgreSQL Database Setup
Installed PostgreSQL and created the production database.

**Commands:**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Enter the Postgres prompt
sudo -u postgres psql
```

**Postgres SQL Commands:**
```sql
CREATE DATABASE coorda_db;
CREATE USER coorda_user WITH PASSWORD 'Your!Super#Secure$Password';
ALTER ROLE coorda_user SET client_encoding TO 'utf8';
ALTER ROLE coorda_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE coorda_user SET timezone TO 'UTC';
ALTER DATABASE coorda_db OWNER TO coorda_user;

-- Fix for PostgreSQL 15+ Schema Permissions
\c coorda_db
GRANT ALL ON SCHEMA public TO coorda_user;
\q
```

## 4. Django Production Prep
With the database running, the virtual environment activated, and the code pulled from Git:

```bash
# Apply database migrations
python manage.py migrate

# Create the initial admin user
python manage.py createsuperuser

# Gather all static files (CSS/JS) for Nginx to serve
python manage.py collectstatic
```

## 5. Gunicorn Setup (Application Server)
Gunicorn translates HTTP requests into Python code. Instead of running it manually, we created a systemd service to run it in the background 24/7.

**Create the service file:**
```bash
sudo nano /etc/systemd/system/gunicorn.service
```

**Configuration:**
```ini
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=nathanoswald1
Group=www-data
WorkingDirectory=/home/nathanoswald1/coorda/scheduler
ExecStart=/home/nathanoswald1/coorda/scheduler/venv/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/home/nathanoswald1/coorda/scheduler/scheduler.sock \
          scheduler.wsgi:application

[Install]
WantedBy=multi-user.target
```

**Start and enable the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
```

## 6. Nginx Setup (Web Server / Reverse Proxy)
Nginx listens on port 80, serves static files instantly, and passes everything else to Gunicorn via the `.sock` file.

**Install Nginx:**
```bash
sudo apt install -y nginx
```

**Create the configuration file:**
```bash
sudo nano /etc/nginx/sites-available/scheduler
```

**Configuration:**
```nginx
server {
    listen 80;
    server_name oswald1.cs.arizona.edu;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        root /home/nathanoswald1/coorda/scheduler;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/home/nathanoswald1/coorda/scheduler/scheduler.sock;
    }
}
```

**Enable the site and restart:**
```bash
sudo ln -s /etc/nginx/sites-available/scheduler /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7. Fixing Linux Home Directory Permissions (The 502 Bad Gateway Fix)
Because the project lives in a user's home directory (`/home/nathanoswald1/...`), Nginx (`www-data`) could not reach the `scheduler.sock` file, resulting in a 502 Error.

**Granted execute (pass-through) permissions to the home directories:**
```bash
chmod +x /home/nathanoswald1
chmod +x /home/nathanoswald1/coorda
chmod +x /home/nathanoswald1/coorda/scheduler
sudo systemctl restart nginx
```

## 8. Accessing the Live Site
1. Ensure you are connected to the standard University of Arizona VPN (`vpn.arizona.edu`).
2. Browsers will default to HTTPS (Port 443). Since we only configured Port 80, you **must** explicitly type the `http://` protocol.
3. **URL:** `http://oswald1.cs.arizona.edu/login/`