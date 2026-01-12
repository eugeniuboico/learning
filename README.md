# 🎓 Learning Platform

Platformă de învățare cu gamification, sistem de puncte, chat în timp real și management de task-uri.

## 📁 Structură Proiect

- **client/**: Frontend (React + TypeScript + Vite + Tailwind CSS)
- **server/**: Backend (Node.js + Express + MySQL + Socket.IO)

## 🚀 Setup Rapid (Pentru PC Nou)

### Metoda 1: Script Automat (Recomandat pentru Windows)

```bash
setup.bat
```

Acest script va:
1. ✅ Instala toate dependențele
2. ✅ Crea fișierul .env
3. ✅ Configura baza de date complet

### Metoda 2: Setup Manual

#### Pas 1: Asigură-te că MySQL rulează
Pornește Laragon sau serverul MySQL.

#### Pas 2: Creează baza de date
```sql
CREATE DATABASE IF NOT EXISTS learning;
```

#### Pas 3: Configurează .env
```bash
cd server
copy .env.example .env
```

Editează `server/.env` cu credențialele tale MySQL.

#### Pas 4: Instalează dependențele
```bash
# Server
cd server
npm install

# Client (în terminal nou)
cd client
npm install
```

#### Pas 5: Setup baza de date
```bash
cd server
node scripts/setup_database.js
```

#### Pas 6: Pornește aplicația

**Terminal 1 - Backend:**
```bash
cd server
node index.js
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

#### Pas 7: Creează admin
1. Deschide `http://localhost:5173`
2. Înregistrează-te cu un cont nou
3. Editează `server/scripts/promote_admin.js` (linia 40) cu email-ul tău
4. Rulează: `node server/scripts/promote_admin.js`

## 📚 Documentație Detaliată

Pentru instrucțiuni complete și troubleshooting, vezi:
- **[server/SETUP_GUIDE.md](server/SETUP_GUIDE.md)** - Ghid detaliat de setup
- **[server/setup_database.sql](server/setup_database.sql)** - Schema completă a bazei de date

## ✨ Funcționalități

- 🔐 Autentificare cu email și cod 2FA
- 📊 Sistem de puncte (stars) și leaderboard
- 🛤️ Căi de învățare (Paths) cu lecții și task-uri
- 📝 Task-uri cu deadline-uri și upload de fișiere
- 💬 Chat în timp real cu Socket.IO
- 👥 Sistem de utilizatori online
- 🖼️ Upload de imagini în chat
- 👨‍💼 Panou de administrare

## 🗄️ Structura Bazei de Date

Aplicația folosește următoarele tabele:
- `users` - Utilizatori și autentificare
- `paths` - Căi de învățare
- `lessons` - Lecții în cadrul căilor
- `tasks` - Task-uri cu deadline-uri
- `user_progress` - Progresul utilizatorilor
- `chats` - Chat-uri de grup
- `messages` - Mesaje în timp real

## 🔧 Comenzi Utile

```bash
# Pornire server (development)
cd server && npx nodemon index.js

# Pornire client (development)
cd client && npm run dev

# Build client pentru producție
cd client && npm run build

# Promovare utilizator la admin
node server/scripts/promote_admin.js

# Backup baza de date
mysqldump -u root -p learning > backup.sql

# Restore baza de date
mysql -u root -p learning < backup.sql
```

## ⚠️ Troubleshooting

### Serverul nu pornește
- Verifică că MySQL rulează
- Verifică credențialele în `.env`
- Verifică că portul 3001 este liber

### Baza de date nu se conectează
- Verifică că baza `learning` există
- Rulează din nou: `node scripts/setup_database.js`

### Email-urile nu se trimit
- Normal în development - codurile apar în consolă
- Pentru email real, configurează EMAIL_USER și EMAIL_PASS în `.env`

## 📝 Note Importante

1. **Backup regulat**: Salvează baza de date periodic
2. **Securitate**: Schimbă JWT_SECRET în producție
3. **Email**: Configurează Gmail App Password pentru email-uri reale

## 🎉 Succes!

Aplicația ta ar trebui să funcționeze perfect acum. Toate datele și funcționalitățile sunt restaurate!

