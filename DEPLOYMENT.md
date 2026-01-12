# 🚀 Deployment Guide - Contabo Server

Ghid complet pentru deployment pe server Contabo.

## 📋 Cuprins

1. [Pregătire Locală](#1-pregătire-locală)
2. [Setup Server](#2-setup-server)
3. [Configurare Database](#3-configurare-database)
4. [Configurare Backend](#4-configurare-backend)
5. [Configurare Frontend](#5-configurare-frontend)
6. [Configurare Nginx](#6-configurare-nginx)
7. [SSL Certificate](#7-ssl-certificate)
8. [Maintenance](#8-maintenance)

---

## 1. Pregătire Locală

### Build Aplicația

**Windows:**
```bash
deploy.bat
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

Acesta creează directorul `deploy/` cu:
- `server/` - Backend build
- `client/` - Frontend build (dist)
- `.env.example` files

### Upload pe Server

```bash
# Folosind SCP
scp -r deploy/* user@YOUR_SERVER_IP:/var/www/learning-platform/

# Sau folosește FileZilla / WinSCP pentru GUI
```

---

## 2. Setup Server

### Conectare SSH

```bash
ssh root@YOUR_SERVER_IP
```

### Instalare Dependințe

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install MySQL
apt install -y mysql-server

# Install PM2 (pentru a rula Node.js permanent)
npm install -g pm2

# Install Nginx
apt install -y nginx

# Verifică instalările
node -v   # should be v18+
npm -v
mysql --version
nginx -v
```

---

## 3. Configurare Database

### Securizare MySQL

```bash
mysql_secure_installation
```

Răspunde:
- Set root password? **Yes** → alege o parolă puternică
- Remove anonymous users? **Yes**
- Disallow root login remotely? **Yes**
- Remove test database? **Yes**
- Reload privilege tables? **Yes**

### Creare Database și User

```bash
mysql -u root -p
```

În MySQL:
```sql
CREATE DATABASE learning_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'learning_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD_HERE';

GRANT ALL PRIVILEGES ON learning_platform.* TO 'learning_user'@'localhost';

FLUSH PRIVILEGES;

SHOW DATABASES;  -- Verifică că learning_platform există

EXIT;
```

---

## 4. Configurare Backend

### Creează Director și Setează Permisiuni

```bash
mkdir -p /var/www/learning-platform
cd /var/www/learning-platform
```

### Configurare .env

```bash
cd server
cp .env.example .env
nano .env
```

Editează `.env` cu valorile tale:

```env
# Database
DB_HOST=localhost
DB_USER=learning_user
DB_PASSWORD=YOUR_SECURE_PASSWORD_HERE
DB_NAME=learning_platform

# JWT (GENEREAZĂ NOU!)
JWT_SECRET=GENERATE_WITH_openssl_rand_base64_32

# Email (Gmail App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx

# Server
PORT=3001
NODE_ENV=production

# Frontend (înlocuiește cu domeniul tău)
FRONTEND_URL=http://your-domain.com
```

**Generează JWT_SECRET:**
```bash
openssl rand -base64 32
```

### Instalare Dependințe

```bash
npm install --production
```

### Setup Database

```bash
npm run setup:db
```

### Creează Director Uploads

```bash
mkdir -p uploads
chmod 755 uploads
```

### Start cu PM2

```bash
pm2 start index.js --name learning-api

# Verifică status
pm2 status

# Vezi logs
pm2 logs learning-api

# Configurare auto-restart la reboot
pm2 startup
pm2 save
```

---

## 5. Configurare Frontend

### Verifică Build-ul

```bash
cd /var/www/learning-platform/client
ls -la  # Ar trebui să vezi index.html și assets/
```

### Setează Permisiuni

```bash
chown -R www-data:www-data /var/www/learning-platform/client
chmod -R 755 /var/www/learning-platform/client
```

---

## 6. Configurare Nginx

### Creare Configurație Site

```bash
nano /etc/nginx/sites-available/learning-platform
```

Adaugă configurația:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # Root pentru frontend build
    root /var/www/learning-platform/client;
    index index.html;

    # Logs
    access_log /var/log/nginx/learning-platform-access.log;
    error_log /var/log/nginx/learning-platform-error.log;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend Proxy
    location /api {
        rewrite ^/api(.*)$ $1 break;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # User Uploads
    location /uploads {
        alias /var/www/learning-platform/server/uploads;
        autoindex off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Activare Site

```bash
# Link simbolic
ln -s /etc/nginx/sites-available/learning-platform /etc/nginx/sites-enabled/

# Remove default site (opțional)
rm /etc/nginx/sites-enabled/default

# Test configurație
nginx -t

# Restart Nginx
systemctl restart nginx

# Verifică status
systemctl status nginx
```

---

## 7. SSL Certificate (Let's Encrypt)

### Instalare Certbot

```bash
apt install certbot python3-certbot-nginx
```

### Obține Certificat

```bash
certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com
```

Urmează instrucțiunile:
1. Introdu email-ul tău
2. Acceptă Terms of Service
3. (Opțional) Newsletter
4. Alege **2** pentru redirect automat HTTP → HTTPS

### Auto-renewal

Certbot configurează auto-renewal. Verifică:

```bash
certbot renew --dry-run
```

### Actualizare Backend .env

```bash
nano /var/www/learning-platform/server/.env
```

Schimbă:
```env
FRONTEND_URL=https://your-domain.com
```

Restart backend:
```bash
pm2 restart learning-api
```

---

## 8. Maintenance

### Comenzi Utile PM2

```bash
# Status
pm2 status

# Restart
pm2 restart learning-api

# Stop
pm2 stop learning-api

# Logs (ultimele 100 linii)
pm2 logs learning-api --lines 100

# Monitor real-time
pm2 monit

# Delete process
pm2 delete learning-api
```

### Backup Database

**Manual:**
```bash
mysqldump -u learning_user -p learning_platform > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Automated (Cron job):**
```bash
crontab -e
```

Adaugă:
```cron
# Backup database zilnic la 2 AM
0 2 * * * mysqldump -u learning_user -pYOUR_PASSWORD learning_platform > /backups/db_$(date +\%Y\%m\%d).sql

# Cleanup backups mai vechi de 7 zile
0 3 * * * find /backups -name "db_*.sql" -mtime +7 -delete
```

### Restore Database

```bash
mysql -u learning_user -p learning_platform < backup_20260112.sql
```

### Update Aplicația

```bash
# Pe local: rebuild
deploy.bat  # sau deploy.sh

# Upload noul build
scp -r deploy/* user@server:/var/www/learning-platform/

# Pe server:
cd /var/www/learning-platform/server
npm install --production
pm2 restart learning-api

# Update frontend
cd /var/www/learning-platform/client
# (fișierele sunt deja încărcate de la deploy)
```

### Monitorizare Logs

```bash
# Nginx access logs
tail -f /var/log/nginx/learning-platform-access.log

# Nginx error logs
tail -f /var/log/nginx/learning-platform-error.log

# PM2 logs
pm2 logs learning-api --lines 50

# MySQL logs
tail -f /var/log/mysql/error.log
```

### Verificare Disk Space

```bash
df -h
du -sh /var/www/learning-platform/*
du -sh /var/www/learning-platform/server/uploads
```

### Firewall Setup

```bash
# Permite HTTP, HTTPS, SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Status
ufw status
```

---

## 🔧 Troubleshooting

### Backend nu pornește

```bash
# Verifică logs
pm2 logs learning-api

# Verifică MySQL
systemctl status mysql

# Test database connection
mysql -u learning_user -p learning_platform -e "SELECT 1;"
```

### Nginx 502 Bad Gateway

```bash
# Verifică că backend rulează
pm2 status
curl http://localhost:3001

# Verifică Nginx logs
tail -f /var/log/nginx/error.log
```

### Socket.IO nu se conectează

**Fix Nginx config:**
```nginx
location /socket.io {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Apoi:
```bash
nginx -t && systemctl reload nginx
```

### Uploads nu funcționează

```bash
# Creează director și setează permisiuni
mkdir -p /var/www/learning-platform/server/uploads
chown -R www-data:www-data /var/www/learning-platform/server/uploads
chmod -R 755 /var/www/learning-platform/server/uploads

# Verifică Nginx poate accesa
ls -la /var/www/learning-platform/server/uploads
```

---

## ✅ Checklist Final

- [ ] Database creat și utilizator configurat
- [ ] Backend `.env` configurat cu toate variabilele
- [ ] JWT_SECRET generat și setat
- [ ] `npm install --production` în server
- [ ] `npm run setup:db` executat cu succes
- [ ] PM2 pornit: `pm2 start index.js --name learning-api`
- [ ] PM2 startup configurat
- [ ] Frontend files în `/var/www/learning-platform/client`
- [ ] Nginx configurat și activat
- [ ] SSL certificate instalat (Let's Encrypt)
- [ ] Firewall configurat (UFW)
- [ ] Backup cron job setat
- [ ] Primul admin promovat: `node scripts/promote_admin.js`

---

**🎉 Aplicația ta este acum LIVE pe Contabo!**

Accesează: `https://your-domain.com`
