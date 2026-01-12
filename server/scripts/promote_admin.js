const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });
// Also try default .env if not found above or just rely on defaults
if (!process.env.DB_USER) dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'learning',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

async function promoteToAdmin(email) {
  try {
    const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log(`User with email ${email} not found.`);
      process.exit(1);
    }

    await promisePool.query('UPDATE users SET role = ?, is_approved = ? WHERE email = ?', ['admin', true, email]);
    console.log(`User ${email} has been promoted to ADMIN and approved.`);
    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  }
}

// Change this email to the one you want to promote
const targetEmail = 'eugenboico54@gmail.com'; 
promoteToAdmin(targetEmail);

