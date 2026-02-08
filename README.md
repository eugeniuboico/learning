# 🎓 VibeCoded Learning Platform

Platformă modernă de învățare cu gamification, sistem de puncte, chat în timp real și management de task-uri.

## 📋 Cuprins

- [Funcționalități](#-funcționalități)
- [Stack Tehnologic](#-stack-tehnologic)
- [Setup Local Development](#-setup-local-development)
- [Deployment pe Contabo](#-deployment-pe-contabo)
- [Variabile de Mediu](#-variabile-de-mediu)
- [Structura Proiectului](#-structura-proiectului)
- [Comenzi Utile](#-comenzi-utile)
- [Troubleshooting](#-troubleshooting)

## ✨ Funcționalități

### Pentru Studenți
- 🔐 Autentificare securizată cu email și cod 2FA
- 📊 Sistem de puncte (stars) și leaderboard
- 🛤️ Căi de învățare (Paths) cu lecții și task-uri
- 📝 Task-uri cu deadline-uri și upload de fișiere
- 🔔 Notificări în timp real pentru task-uri noi
- 💬 Chat în timp real cu Socket.IO
- 🖼️ Upload de imagini și fișiere în task-uri și chat
- 👥 Vizualizare utilizatori online
- 🎯 Progres vizual și task-uri deblocate progresiv

### Pentru Administratori
- 👨‍💼 Panou complet de administrare
- ➕ Creare și editare căi de învățare
- 📚 Management lecții și task-uri
- ✅ Aprobare/respingere submisii studenți
- 🔄 Notificări live pentru submisii noi
- 📊 Monitorizare progres studenți

## 🛠️ Stack Tehnologic

### Frontend
- ⚛️ **React 19** cu TypeScript
- ⚡ **Vite** - Build tool rapid
- 🎨 **Tailwind CSS** - Styling modern
- 🔌 **Socket.IO Client** - Real-time communication
- 📝 **TipTap** - Rich text editor

### Backend
- 🚀 **Node.js** + **Express**
- 🗄️ **MySQL** - Database
- 🔌 **Socket.IO** - WebSocket server
- 🔒 **JWT** + **HTTP-only cookies** - Authentication
- 📧 **Nodemailer** - Email notifications
- 🔐 **bcrypt** - Password hashing
- 📁 **Multer** - File uploads

## 💻 Setup Local Development

### Prerequisite

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **MySQL** 8.0+ sau **Laragon**
- **Git**

### Pași de Instalare

#### 1. Clonează Repository-ul

```bash
git clone https://github.com/yourusername/learning_antigravity.git
cd learning_antigravity
```

#### 2. Setup Backend

```bash
cd server
npm install
```

Creează fișier `.env` (copiază din `.env.example`):

```bash
cp .env.example .env
```

Editează `server/.env` cu credențialele tale:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=learning_platform
JWT_SECRET=your_generated_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

#### 3. Setup Database

Creează baza de date:

```sql
CREATE DATABASE learning_platform;
```

Rulează script-ul de setup:

```bash
npm run setup:db
```

#### 4. Setup Frontend

```bash
cd ../client
npm install
```

Creează `client/.env` (opțional pentru local):

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

#### 5. Pornește Aplicația

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Aplicația va fi disponibilă la: `http://localhost:5173`

#### 6. Creează Primul Admin

1. Înregistrează-te cu un cont nou
2. Editează `server/scripts/promote_admin.js` (linia unde se setează email-ul)
3. Rulează:
   ```bash
   node server/scripts/promote_admin.js
   ```

## 🚀 Deployment pe Contabo

### Pregătirea pentru Deployment

#### 1. Build Local

**Windows:**
```bash
deploy.bat
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

Acest script va crea directorul `deploy/` cu tot ce trebuie încărcat pe server.

#### 2. Upload pe Server

Folosind SCP, WinSCP, FileZilla sau rsync:

```bash
# Exemplu cu scp
scp -r deploy/* user@your-server-ip:/var/www/learning-platform/
```

### Setup pe Server Contabo

#### 1. Conectează-te la Server

```bash
ssh user@your-server-ip
```

#### 2. Instalează Dependințele (dacă nu sunt deja instalate)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install PM2 (pentru a rula Node.js în background)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### 3. Configurează MySQL

```bash
sudo mysql_secure_installation
sudo mysql
```

```sql
CREATE DATABASE learning_platform;
CREATE USER 'learning_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON learning_platform.* TO 'learning_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 4. Configurează Backend

```bash
cd /var/www/learning-platform/server
cp .env.example .env
nano .env  # Editează cu credențialele corecte
```

Setează în `.env`:
```env
NODE_ENV=production
FRONTEND_URL=http://your-domain.com
DB_HOST=localhost
DB_USER=learning_user
DB_PASSWORD=your_secure_password
DB_NAME=learning_platform
JWT_SECRET=generate_new_secret_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
PORT=3001
```

Instalează dependințe și setup DB:

```bash
npm install --production
npm run setup:db
```

Pornește cu PM2:

```bash
pm2 start index.js --name learning-api
pm2 save
pm2 startup  # Urmează instrucțiunile
```

#### 5. Configurează Nginx

Creează fișier de configurare:

```bash
sudo nano /etc/nginx/sites-available/learning-platform
```

Adaugă configurația:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    root /var/www/learning-platform/client;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
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
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Uploads
    location /uploads {
        alias /var/www/learning-platform/server/uploads;
    }
}
```

Activează site-ul:

```bash
sudo ln -s /etc/nginx/sites-available/learning-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Configurează SSL (Opțional dar Recomandat)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 7. Actualizează Client `.env` pentru Producție

Pe server, creează `/var/www/learning-platform/client/.env`:

```env
VITE_API_URL=http://your-domain.com/api
VITE_SOCKET_URL=http://your-domain.com
```

Rebuild client (dacă este necesar):

```bash
cd /var/www/learning-platform
# Download surse, rebuild cu npm run build
```

## 🔐 Variabile de Mediu

### Server (`server/.env`)

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `password123` |
| `DB_NAME` | Database name | `learning_platform` |
| `JWT_SECRET` | Secret pentru JWT | Generate cu `openssl rand -base64 32` |
| `EMAIL_USER` | Gmail pentru notificări | `your@gmail.com` |
| `EMAIL_PASS` | App password Gmail | `xxxx xxxx xxxx xxxx` |
| `PORT` | Port server | `3001` |
| `NODE_ENV` | Environment | `development` / `production` |
| `FRONTEND_URL` | URL frontend pentru CORS | `http://localhost:5173` |

### Client (`client/.env`)

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_SOCKET_URL` | WebSocket URL | `http://localhost:3001` |

## 📁 Structura Proiectului

```
learning_antigravity/
├── client/                 # Frontend React
│   ├── components/        # React components
│   ├── contexts/          # React contexts (Socket)
│   ├── hooks/             # Custom hooks
│   ├── config.ts          # API configuration
│   ├── types.ts           # TypeScript types
│   ├── .env.example       # Environment template
│   └── package.json
├── server/                # Backend Node.js
│   ├── scripts/           # Database setup scripts
│   ├── uploads/           # User uploaded files
│   ├── index.js           # Main server file
│   ├── db.js              # Database connection
│   ├── .env.example       # Environment template
│   └── package.json
├── .gitignore
├── deploy.sh              # Linux/Mac deployment script
├── deploy.bat             # Windows deployment script
└── README.md
```

## 🔧 Comenzi Utile

### Development

```bash
# Server development cu auto-restart
cd server && npm run dev

# Client development
cd client && npm run dev

# Type checking (fără build)
cd client && npm run type-check
```

### Production

```bash
# Build client pentru producție
cd client && npm run build

# Start server în mod producție
cd server && npm start

# Preview build local
cd client && npm run preview
```

### Database

```bash
# Setup database complet
cd server && npm run setup:db

# Setup paths (după setup:db)
cd server && npm run setup:paths

# Promovare admin
cd server && node scripts/promote_admin.js

# Backup database
mysqldump -u root -p learning_platform > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u root -p learning_platform < backup_20260112.sql
```

### PM2 (Production)

```bash
# Start cu PM2
pm2 start server/index.js --name learning-api

# Restart
pm2 restart learning-api

# Stop
pm2 stop learning-api

# Logs
pm2 logs learning-api

# Monitor
pm2 monit

# Lista procese
pm2 list
```

## ⚠️ Troubleshooting

### Serverul nu pornește

**Eroare:** `Error: connect ECONNREFUSED`

**Soluție:**
- Verifică că MySQL rulează: `sudo systemctl status mysql`
- Verifică credențialele în `.env`
- Verifică că baza de date există: `mysql -u root -p -e "SHOW DATABASES;"`

### Port 3001 deja folosit

**Eroare:** `Error: listen EADDRINUSE: address already in use :::3001`

**Soluție:**
```bash
# Găsește procesul
lsof -i :3001  # Linux/Mac
netstat -ano | findstr :3001  # Windows

# Omoară procesul
kill -9 PID  # Linux/Mac
taskkill /PID PID /F  # Windows
```

### Email-urile nu se trimit

**În Development:** Normal - codurile 2FA apar în consolă

**În Production:**
1. Folosește Gmail App Password (nu parola ta normală)
2. Activează "Less secure app access" (Nu recomandat)
3. Configurează EMAIL_USER și EMAIL_PASS corect în `.env`

### Socket.IO nu se conectează

**Soluție:**
- Verifică că `VITE_SOCKET_URL` în client/.env este corect
- Verifică CORS în server: `allowedOrigins` trebuie să includă domeniul tău
- În production, verifică configurația Nginx pentru `/socket.io`

### Build client eșuează

**Eroare:** TypeScript errors

**Soluție:**
```bash
cd client
npm run type-check  # Vezi toate erorile
# Repară erorile, apoi:
npm run build
```

### Uploads nu funcționează în production

**Soluție:**
```bash
# Creează director uploads și dă permisiuni
sudo mkdir -p /var/www/learning-platform/server/uploads
sudo chown -R www-data:www-data /var/www/learning-platform/server/uploads
sudo chmod -R 755 /var/www/learning-platform/server/uploads
```

## 🔒 Securitate

### Important pentru Producție

1. **Schimbă JWT_SECRET:**
   ```bash
   openssl rand -base64 32
   ```

2. **Folosește HTTPS:** Instalează SSL cu Let's Encrypt

3. **Actualizează dependințele regulat:**
   ```bash
   npm audit
   npm audit fix
   ```

4. **Backup regulat:**
   - Database: zilnic
   - Uploads: săptămânal
   - Configurații: la fiecare modificare

5. **Firewall:**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

## 📝 Note

- **Students vs Admins:** La crearea contului, toți sunt studenți. Pentru admin: `node scripts/promote_admin.js`
- **Task Approvals:** Doar adminii pot aproba/respinge task-uri
- **Real-time:** Socket.IO asigură update-uri instant pentru notificări, chat, și leaderboard
- **File Uploads:** Limită 10MB per fișier (configurabil în `server/index.js` - multer config)

## 🤝 Contribuții

Pentru bug-uri sau feature requests, deschide un issue pe GitHub.

## 📄 Licență

ISC

---

**Made with ❤️ for Antigravity Learning**
