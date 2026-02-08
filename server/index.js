require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Environment variables with fallbacks
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS origins - in production, only allow specific domain
const allowedOrigins = NODE_ENV === 'production' 
  ? [FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', FRONTEND_URL];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Track online users: Map<userId, {socketId, name, avatar_url}>
const onlineUsers = new Map();

async function ensureUsersAvatarUrlColumn() {
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'"
    );
    if (cols.length === 0) {
      await db.query("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL");
    }
  } catch (err) {
    console.error('[DB] Failed to ensure users.avatar_url column:', err.message || err);
  }
}

async function ensureMessagesImagesColumn() {
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'images'"
    );
    if (cols.length === 0) {
      await db.query("ALTER TABLE messages ADD COLUMN images TEXT NULL");
    }
  } catch (err) {
    console.error('[DB] Failed to ensure messages.images column:', err.message || err);
  }
}

async function ensureChatTables() {
  try {
    // Create chats table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `    );

    // Create chat_members table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_chat_member (chat_id, user_id)
      )
    `    );

    // Create messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_chat_created (chat_id, created_at)
      )
    `    );
  } catch (err) {
    console.error('[DB] Failed to ensure chat tables:', err.message || err);
  }
}

async function ensureSubmissionStatusColumn() {
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_submissions' AND COLUMN_NAME = 'status'"
    );
    if (cols.length === 0) {
      await db.query("ALTER TABLE task_submissions ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'");
    }
  } catch (err) {
    console.error('[DB] Failed to ensure task_submissions.status column:', err.message || err);
  }
}

async function ensureSubmissionViewedColumn() {
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_submissions' AND COLUMN_NAME = 'is_viewed'"
    );
    if (cols.length === 0) {
      await db.query("ALTER TABLE task_submissions ADD COLUMN is_viewed BOOLEAN DEFAULT FALSE");
    }
  } catch (err) {
    console.error('[DB] Failed to ensure task_submissions.is_viewed column:', err.message || err);
  }
}

// CORS configuration (using allowedOrigins defined at top)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Allow documents, images, PDFs, and web files (HTML, CSS, JS)
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|html|htm|css|js/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: documents, images, PDFs, HTML, CSS, JS.'));
    }
  }
});

// Configurare Nodemailer (Email)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback_dev');
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to send email
const sendLoginCode = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"Learning App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #333;">Learning App Login</h2>
          <p>Hello,</p>
          <p>Your authentication code is:</p>
          <h1 style="color: #4CAF50; letter-spacing: 5px; background: #f9f9f9; padding: 10px; text-align: center; border-radius: 5px;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('[ERROR] Failed to send email:', error);
    // Nu aruncam eroare aici ca sa nu blocam procesul, dar e bine de stiut
  }
};

// Generic helper function to send any email
const sendEmail = async (email, subject, htmlContent) => {

  try {
    await transporter.sendMail({
      from: `"Learning Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent
    });
  } catch (error) {
    console.error('[ERROR] Failed to send email:', error);
  }
};

// Helper function to send notification email
const sendNotificationEmail = async (email, subject, message) => {

  try {
    await transporter.sendMail({
      from: `"Learning Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #333;">🎓 Learning Platform</h2>
          <p>${message}</p>
          <p style="margin-top: 20px;">
            <a href="${FRONTEND_URL}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Access Platform
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">This email was sent automatically by Learning Platform.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('[ERROR] Failed to send notification email:', error);
  }
};

// 1. Endpoint: Login Inițial (Verifică parola -> Trimite cod)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const user = users[0];

    // Verifică parola
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    // Verifică dacă contul e aprobat
    if (!user.is_approved && user.role !== 'admin') { // Adminii trec direct, de obicei, dar poți schimba
      return res.status(403).json({ error: 'Your account has not been approved by an administrator yet.' });
    }

    // Generează cod 6 cifre
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvează codul în DB (expiră în 10 min)
    await db.query(
      'UPDATE users SET login_code = ?, login_code_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [code, user.id]
    );

    // Trimite email (sau loghează în consolă)
    await sendLoginCode(user.email, code);

    res.json({ message: 'Code sent via email.', step: 'code_required', userId: user.id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 2. Endpoint: Verificare Cod (Finalizează Login)
app.post('/verify-code', async (req, res) => {
  const { userId, code } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = users[0];

    // Verifică codul
    if (user.login_code !== code) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }

    // Verifică expirarea
    const now = new Date();
    if (new Date(user.login_code_expires) < now) {
      return res.status(400).json({ error: 'Code expired. Please try again.' });
    }

    // Login cu succes -> Șterge codul folosit
    await db.query('UPDATE users SET login_code = NULL, login_code_expires = NULL WHERE id = ?', [userId]);

    // Generare Token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret_fallback_dev',
      { expiresIn: '24h' }
    );

    // Setare Cookie HTTP-Only
    const isProduction = NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      message: 'Authentication successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        stars: user.stars,
        avatar_url: user.avatar_url || null
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// 3. Endpoint: Check Session (Verifică dacă userul e logat prin cookie)
app.get('/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback_dev');

    const [users] = await db.query('SELECT id, name, email, role, stars, avatar_url FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ user: users[0] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update own profile (name + avatar) - must be authenticated
app.put('/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback_dev');
    const { name, avatar_url } = req.body || {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }

    await db.query(
      'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?',
      [name.trim(), avatar_url || null, decoded.id]
    );

    const [users] = await db.query('SELECT id, name, email, role, stars, avatar_url FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ user: users[0] });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// 4. Endpoint: Logout (Șterge cookie-ul)
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Helper function to create notification
async function createNotification(userId, type, title, message, link = null, metadata = null) {
  try {
    const [result] = await db.query(
      'INSERT INTO notifications (user_id, type, title, message, link, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, title, message, link, metadata ? JSON.stringify(metadata) : null]
    );

    // Get the created notification
    const [notifications] = await db.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    if (notifications.length > 0) {
      const notification = notifications[0];

      // Parse metadata if it's a string
      if (notification.metadata && typeof notification.metadata === 'string') {
        try {
          notification.metadata = JSON.parse(notification.metadata);
        } catch (e) {
          console.error('[Notification] Failed to parse metadata:', e);
          notification.metadata = null;
        }
      }

      // Emit to user via Socket.IO
      io.emit('new_notification', { userId, notification });
    }
  } catch (error) {
    console.error('[Notification] Error creating notification:', error);
  }
}

// Helper function to notify all admins
async function notifyAdmins(type, title, message, link = null, metadata = null) {
  try {
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await createNotification(admin.id, type, title, message, link, metadata);
    }
  } catch (error) {
    console.error('[Notification] Error notifying admins:', error);
  }
}

// Register Endpoint
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, stars, is_approved) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'student', 0, false]
    );

    // Notify all admins about new user registration
    await notifyAdmins(
      'new_user_pending',
      'New User Registered',
      `${name} (${email}) is waiting for approval.`,
      null,
      { userId: result.insertId, email, name }
    );

    // Send email to admins
    const [admins] = await db.query("SELECT email FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await sendNotificationEmail(
        admin.email,
        'New User Registered',
        `A new user <strong>${name}</strong> (${email}) is waiting for approval on the Learning Platform.`
      );
    }

    res.status(201).json({
      message: 'Account created successfully! Waiting for administrator approval.',
      userId: result.insertId
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 5. Endpoint: Get All Users (Leaderboard) - Exclude admins and unapproved users
app.get('/users', async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, name, stars, avatar_url FROM users WHERE role != 'admin' AND is_approved = TRUE ORDER BY stars DESC");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Approve user (admin only)
app.post('/users/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user details
    const [targetUser] = await db.query('SELECT name, email FROM users WHERE id = ?', [id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Approve user
    await db.query('UPDATE users SET is_approved = TRUE WHERE id = ?', [id]);

    // Update all pending notifications for this user to approved
    await db.query(
      "UPDATE notifications SET status = 'approved', is_read = TRUE WHERE type = 'new_user_pending' AND JSON_EXTRACT(metadata, '$.userId') = ?",
      [id]
    );

    // Notify user
    await createNotification(
      id,
      'account_approved',
      'Account Approved! 🎉',
      'Your account has been approved by an administrator. You can now access the platform.',
      null,
      null
    );

    // Send email to user
    await sendNotificationEmail(
      targetUser[0].email,
      'Account Approved! 🎉',
      `Hello <strong>${targetUser[0].name}</strong>!<br><br>Your account on the Learning Platform has been approved by an administrator. You can now log in and start learning!`
    );

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('[Approve User] Error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject user (admin only)
app.post('/users/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user details
    const [targetUser] = await db.query('SELECT name, email FROM users WHERE id = ?', [id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update all pending notifications for this user to rejected
    await db.query(
      "UPDATE notifications SET status = 'rejected', is_read = TRUE WHERE type = 'new_user_pending' AND JSON_EXTRACT(metadata, '$.userId') = ?",
      [id]
    );

    // Notify user before deleting
    await createNotification(
      id,
      'account_rejected',
      'Account Rejected',
      'Your registration request has been rejected by an administrator.',
      null,
      null
    );

    // Send email to user
    await sendNotificationEmail(
      targetUser[0].email,
      'Registration Request Rejected',
      `Hello <strong>${targetUser[0].name}</strong>.<br><br>Unfortunately, your registration request on the Learning Platform has been rejected by an administrator.`
    );

    // Delete user
    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User rejected and deleted' });
  } catch (error) {
    console.error('[Reject User] Error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// ================================================
// USER MANAGEMENT ENDPOINTS (Admin only)
// ================================================

// Get all users (Admin only, including all fields)
app.get('/admin/users', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const [currentUser] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (currentUser.length === 0 || currentUser[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [users] = await db.query(
      'SELECT id, name, email, role, stars, avatar_url, is_approved, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(users);
  } catch (error) {
    console.error('[Admin Get Users] Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (Admin only)
app.put('/admin/users/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, is_approved } = req.body;

    // Check if user is admin
    const [currentUser] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (currentUser.length === 0 || currentUser[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if target user exists
    const [targetUser] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update fields
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }

    if (is_approved !== undefined) {
      updates.push('is_approved = ?');
      values.push(is_approved === 'true' || is_approved === true ? 1 : 0);
    }

    // Handle avatar upload
    if (req.file) {
      const avatarPath = `/uploads/${req.file.filename}`;
      updates.push('avatar_url = ?');
      values.push(avatarPath);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated user
    const [updatedUser] = await db.query(
      'SELECT id, name, email, role, stars, avatar_url, is_approved, created_at FROM users WHERE id = ?',
      [id]
    );

    res.json({ message: 'User updated successfully', user: updatedUser[0] });
  } catch (error) {
    console.error('[Admin Update User] Error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
app.delete('/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const [currentUser] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (currentUser.length === 0 || currentUser[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if target user exists
    const [targetUser] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (CASCADE will handle related records)
    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('[Admin Delete User] Error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Add stars to user (Admin only)
app.post('/admin/users/:id/add-stars', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stars } = req.body;

    // Check if user is admin
    const [currentUser] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (currentUser.length === 0 || currentUser[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Validate stars amount
    if (!stars || isNaN(stars) || parseInt(stars) <= 0) {
      return res.status(400).json({ error: 'Invalid stars amount' });
    }

    const starsToAdd = parseInt(stars);

    // Check if target user exists
    const [targetUser] = await db.query('SELECT id, name, email, stars FROM users WHERE id = ?', [id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add stars to user
    await db.query('UPDATE users SET stars = stars + ? WHERE id = ?', [starsToAdd, id]);

    // Get updated user
    const [updatedUser] = await db.query('SELECT id, name, email, role, stars, avatar_url FROM users WHERE id = ?', [id]);

    // Create notification for user
    await createNotification(
      parseInt(id),
      'stars_received',
      `⭐ +${starsToAdd} Stars Received!`,
      `You've received ${starsToAdd} star${starsToAdd > 1 ? 's' : ''} from the administrator! Keep up the great work!`,
      null,
      JSON.stringify({ starsAdded: starsToAdd, newTotal: updatedUser[0].stars })
    );

    // Emit Socket.IO events to update UI
    io.emit('leaderboard:update'); // Update leaderboard for everyone
    io.emit('user:stars_updated', { userId: parseInt(id), stars: updatedUser[0].stars }); // Update user's header

    res.json({ 
      message: 'Stars added successfully', 
      user: updatedUser[0],
      starsAdded: starsToAdd 
    });
  } catch (error) {
    console.error('[Admin Add Stars] Error:', error);
    res.status(500).json({ error: 'Failed to add stars' });
  }
});

// Get notifications for current user
app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    // Parse metadata JSON safely
    const parsedNotifications = notifications.map(n => {
      let parsedMetadata = n.metadata;
      if (n.metadata && typeof n.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(n.metadata);
        } catch (e) {
          console.error('[Get Notifications] Failed to parse metadata for notification', n.id);
          parsedMetadata = null;
        }
      }
      return {
        ...n,
        metadata: parsedMetadata
      };
    });

    res.json(parsedNotifications);
  } catch (error) {
    console.error('[Get Notifications] Error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('[Mark Notification Read] Error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
app.put('/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Mark All Read] Error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
app.delete('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('[Delete Notification] Error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all notifications
app.delete('/notifications', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM notifications WHERE user_id = ?',
      [req.user.id]
    );

    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('[Delete All Notifications] Error:', error);
    res.status(500).json({ error: 'Failed to delete all notifications' });
  }
});

// Mark task as viewed by student (remove NEW badge)
app.post('/tasks/:taskId/mark-viewed', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    // Update viewed_at timestamp for this student-task combination
    await db.query(`
      INSERT INTO user_task_views (user_id, task_id, viewed_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE viewed_at = NOW()
    `, [userId, taskId]);

    // Emit Socket.IO event for live badge update
    io.emit('task:viewed', { taskId, userId });

    res.json({ success: true, message: 'Task marked as viewed' });
  } catch (error) {
    console.error('[Mark Task Viewed] Error:', error);
    res.status(500).json({ error: 'Failed to mark task as viewed' });
  }
});

// --- PATHS API ---

// Get all paths with unlock status for current user
app.get('/paths', async (req, res) => {
  const token = req.cookies.token;
  let userId = null;
  let userRole = 'student';

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback_dev');
      userId = decoded.id;
    } catch (e) { }
  }

  try {
    const [paths] = await db.query('SELECT * FROM paths ORDER BY stars_required ASC, id ASC');

    // Get user's stars, role, and unlocked paths
    let userStars = 0;
    let unlockedPathIds = new Set();

    if (userId) {
      const [userRows] = await db.query('SELECT stars, role FROM users WHERE id = ?', [userId]);
      if (userRows.length > 0) {
        userStars = userRows[0].stars || 0;
        userRole = userRows[0].role || 'student';
      }

      const [unlockedRows] = await db.query('SELECT path_id FROM user_paths WHERE user_id = ?', [userId]);
      unlockedRows.forEach(row => unlockedPathIds.add(row.path_id));
    }

    // Calculate status for each path
    const pathsWithStatus = paths.map(path => {
      let status = 'locked';

      // Admin has access to all paths automatically
      if (userRole === 'admin') {
        status = 'in-progress';
      } else if (unlockedPathIds.has(path.id)) {
        status = 'in-progress';
      } else if (path.stars_required === 0 || userStars >= path.stars_required) {
        status = 'unlocked'; // User can unlock this path
      }

      return {
        id: path.id.toString(),
        title: path.name,
        description: path.description,
        status,
        requiredScore: path.stars_required
      };
    });

    res.json(pathsWithStatus);
  } catch (error) {
    console.error('[/paths] Error:', error);
    res.status(500).json({ error: 'Failed to fetch paths' });
  }
});

// Create new path (admin only)
app.post('/paths', authenticateToken, async (req, res) => {
  try {
    const { name, description, stars_required } = req.body;

    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [result] = await db.query(
      'INSERT INTO paths (name, description, stars_required) VALUES (?, ?, ?)',
      [name, description || '', stars_required || 0]
    );

    res.json({
      id: result.insertId,
      name,
      description,
      stars_required: stars_required || 0
    });
  } catch (error) {
    console.error('[POST /paths] Error:', error);
    res.status(500).json({ error: 'Failed to create path' });
  }
});

// Update path (admin only)
app.put('/paths/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, stars_required } = req.body;

    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await db.query(
      'UPDATE paths SET name = ?, description = ?, stars_required = ? WHERE id = ?',
      [name, description || '', stars_required || 0, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[PUT /paths/:id] Error:', error);
    res.status(500).json({ error: 'Failed to update path' });
  }
});

// Delete path (admin only)
app.delete('/paths/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await db.query('DELETE FROM paths WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /paths/:id] Error:', error);
    res.status(500).json({ error: 'Failed to delete path' });
  }
});

// Unlock path for current user
app.post('/paths/:id/unlock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if path exists and get required stars
    const [pathRows] = await db.query('SELECT stars_required FROM paths WHERE id = ?', [id]);
    if (pathRows.length === 0) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const path = pathRows[0];

    // Check if user has enough stars
    const [userRows] = await db.query('SELECT stars FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRows[0];
    if (user.stars < path.stars_required) {
      return res.status(403).json({ error: 'Not enough stars to unlock this path' });
    }

    // Check if already unlocked
    const [existingUnlock] = await db.query('SELECT * FROM user_paths WHERE user_id = ? AND path_id = ?', [userId, id]);
    if (existingUnlock.length > 0) {
      return res.json({ message: 'Path already unlocked' });
    }

    // Unlock the path (don't deduct stars, just grant access)
    await db.query('INSERT INTO user_paths (user_id, path_id) VALUES (?, ?)', [userId, id]);

    res.json({ success: true, message: 'Path unlocked successfully' });
  } catch (error) {
    console.error('[POST /paths/:id/unlock] Error:', error);
    res.status(500).json({ error: 'Failed to unlock path' });
  }
});

// --- PATH & LESSONS API ---

// Get Lessons for a Path (including tasks and status for current user)
app.get('/paths/:pathId/details', async (req, res) => {
  const { pathId } = req.params;
  const token = req.cookies.token;
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback_dev');
      userId = decoded.id;
    } catch (e) { }
  }

  try {
    // 1. Get Lessons
    const [lessons] = await db.query('SELECT * FROM lessons WHERE path_id = ? ORDER BY order_index ASC', [pathId]);

    // 2. Get Tasks for these lessons
    const lessonIds = lessons.map(l => l.id);
    let tasks = [];
    if (lessonIds.length > 0) {
      const [rows] = await db.query(`SELECT * FROM tasks WHERE lesson_id IN (${lessonIds.join(',')})`);
      tasks = rows;

      // Calculate unviewed submissions for admin
      if (userId && tasks.length > 0) {
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (userRows.length > 0 && userRows[0].role === 'admin') {
          const [unviewedCounts] = await db.query(`
             SELECT task_id, COUNT(*) as count 
             FROM task_submissions 
             WHERE task_id IN (${tasks.map(t => t.id).join(',')}) 
             AND status != 'rejected'
             AND (is_viewed = FALSE OR is_viewed IS NULL)
             GROUP BY task_id
           `);

          unviewedCounts.forEach(c => {
            const t = tasks.find(task => task.id === c.task_id);
            if (t) t.unviewed_count = c.count;
          });
        } else if (userRows[0].role === 'student') {
          // For students, check which tasks are NEW (not viewed yet)
          const [taskViews] = await db.query(`
            SELECT task_id, viewed_at
            FROM user_task_views
            WHERE user_id = ? AND task_id IN (${tasks.map(t => t.id).join(',')})
          `, [userId]);

          // Create a map of task_id -> viewed_at
          const viewMap = new Map();
          taskViews.forEach(v => viewMap.set(v.task_id, v.viewed_at));

          // Mark tasks as NEW if they don't have a viewed_at timestamp
          tasks.forEach(task => {
            const viewed = viewMap.get(task.id);
            task.is_new = !viewed; // NEW if viewed_at is NULL
          });
        }
      }
    }

    // 3. Get User Progress (if logged in)
    let completedEntityIds = new Set();
    if (userId) {
      const [progress] = await db.query('SELECT entity_type, entity_id FROM user_progress WHERE user_id = ?', [userId]);
      progress.forEach(p => completedEntityIds.add(`${p.entity_type}_${p.entity_id}`));
    }

    // Construct the response tree
    const result = lessons.map(lesson => {
      const lessonTasks = tasks.filter(t => t.lesson_id === lesson.id);
      const isLessonCompleted = completedEntityIds.has(`lesson_${lesson.id}`);

      // Check if unlocked: Previous lesson must be completed OR it's the first lesson
      // In a real app, you'd implement more complex logic based on mandatory tasks of previous lesson
      // For now, let's say Lesson N is unlocked if Lesson N-1 mandatory tasks are done.

      return {
        ...lesson,
        completed: isLessonCompleted,
        tasks: lessonTasks.map(t => ({
          ...t,
          completed: completedEntityIds.has(`task_${t.id}`)
        }))
      };
    });

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching path details.' });
  }
});

// Create New Lesson (Admin only)
app.post('/lessons', async (req, res) => {
  const { pathId, title, description, x, y, order, parentId } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO lessons (path_id, title, description, position_x, position_y, order_index, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pathId, title, description || '', x || 0, y || 0, order, parentId || null]
    );

    // Emit Socket.IO event for live lesson creation
    io.emit('lesson:created', { lessonId: result.insertId, pathId, title });

    res.status(201).json({ id: result.insertId, message: 'Lesson created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// Update Lesson (Admin only)
app.put('/lessons/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    await db.query(
      'UPDATE lessons SET title = ?, description = ? WHERE id = ?',
      [title, description || '', id]
    );
    res.json({ message: 'Lesson updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// Delete Lesson (Admin only)
app.delete('/lessons/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get lesson info before deleting for Socket.IO event
    const [lessons] = await db.query('SELECT path_id FROM lessons WHERE id = ?', [id]);
    const pathId = lessons.length > 0 ? lessons[0].path_id : null;

    // Tasks will be deleted automatically due to CASCADE
    await db.query('DELETE FROM lessons WHERE id = ?', [id]);

    // Emit Socket.IO event for live lesson deletion
    if (pathId) {
      io.emit('lesson:deleted', { lessonId: id, pathId });
    }

    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// Create New Task (Admin only)
app.post('/tasks', async (req, res) => {
  const { lessonId, title, type, xp, deadline, x, y, order, description } = req.body;

  try {
    // Convert deadline to MySQL format or set to null if not provided
    let mysqlDeadline = null;
    if (deadline) {
      // If deadline is just a date (YYYY-MM-DD), add default time
      if (deadline.length === 10) {
        mysqlDeadline = deadline + ' 23:59:59';
      } else {
        // If it's a full datetime, convert from ISO to MySQL format
        const date = new Date(deadline);
        mysqlDeadline = date.toISOString().slice(0, 19).replace('T', ' ');
      }
    }

    const [result] = await db.query(
      'INSERT INTO tasks (lesson_id, title, type, xp_reward, deadline, position_x, position_y, order_index, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [lessonId, title, type, xp, mysqlDeadline, x || 0, y || 0, order || 1, description || '']
    );

    // Get lesson and path info for notification
    const [lessons] = await db.query(`
      SELECT l.title as lesson_title, l.path_id, p.name as path_name 
      FROM lessons l
      INNER JOIN paths p ON l.path_id = p.id
      WHERE l.id = ?
    `, [lessonId]);

    if (lessons.length > 0) {
      const lesson = lessons[0];
      const taskType = type === 'mandatory' ? 'Mandatory' : 'Optional';

      // Notify all students who have unlocked this path
      const [students] = await db.query(`
        SELECT DISTINCT u.id, u.name, u.email
        FROM users u
        INNER JOIN user_paths up ON u.id = up.user_id
        WHERE up.path_id = ? AND u.role = 'student' AND u.is_approved = TRUE
      `, [lesson.path_id]);

      for (const student of students) {
        // Create in-app notification
        await createNotification(
          student.id,
          'new_task',
          'New Task Available! 📝',
          `Task: "${title}" (${taskType})\nPath: ${lesson.path_name}\nLesson: ${lesson.lesson_title}`,
          null,
          { taskId: result.insertId, lessonId, pathId: lesson.path_id, type, deadline: mysqlDeadline }
        );

        // Send email notification
        await sendNotificationEmail(
          student.email,
          'New Task Available! 📝',
          `Hello <strong>${student.name}</strong>!<br><br>
          A new task has been added to your learning path:<br><br>
          <strong>Task:</strong> ${title}<br>
          <strong>Type:</strong> <span style="color: ${type === 'mandatory' ? '#dc2626' : '#16a34a'};">${taskType}</span><br>
          <strong>Path:</strong> ${lesson.path_name}<br>
          <strong>Lesson:</strong> ${lesson.lesson_title}<br>
          ${deadline ? `<strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>` : ''}
          <br>
          Log in to the platform to view the task details and start working on it!`
        );
      }

      // Mark task as NEW for all these students (viewed_at = NULL means it's new)
      if (students.length > 0) {
        const values = students.map(student => [student.id, result.insertId, null]);
        await db.query(`
          INSERT INTO user_task_views (user_id, task_id, viewed_at)
          VALUES ?
        `, [values]);
      }
    }

    // Emit Socket.IO event for live task creation
    io.emit('task:created', {
      taskId: result.insertId,
      lessonId,
      title,
      type
    });

    res.status(201).json({ id: result.insertId, message: 'Task created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update Task (Admin only)
app.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, type, xp, deadline, description } = req.body;


  try {
    // Convert ISO datetime to MySQL format
    let mysqlDeadline = null;
    if (deadline) {
      const date = new Date(deadline);
      mysqlDeadline = date.toISOString().slice(0, 19).replace('T', ' ');
    }

    const result = await db.query(
      'UPDATE tasks SET title = ?, type = ?, xp_reward = ?, deadline = ?, description = ? WHERE id = ?',
      [title, type, xp || 0, mysqlDeadline, description || '', id]
    );

    // Emit Socket.IO event for live task update
    io.emit('task:updated', {
      taskId: id,
      title,
      type,
      xp,
      deadline
    });

    res.json({ message: 'Task updated' });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

// Delete Task (Admin only)
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM tasks WHERE id = ?', [id]);

    // Emit Socket.IO event for live task deletion
    io.emit('task:deleted', { taskId: id });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get Task Details
app.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Upload Task Submission
app.post('/tasks/:id/submit', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const userId = req.body.userId; // Should come from authenticated session in production

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO task_submissions (task_id, user_id, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)',
      [id, userId, req.file.originalname, req.file.filename, req.file.size]
    );

    // Get task, lesson, path and user info
    const [tasks] = await db.query('SELECT title, lesson_id, type FROM tasks WHERE id = ?', [id]);
    const [users] = await db.query('SELECT name, email FROM users WHERE id = ?', [userId]);

    if (tasks.length > 0 && users.length > 0) {
      const task = tasks[0];

      // Get lesson and path details
      const [lessons] = await db.query('SELECT title as lesson_title, path_id FROM lessons WHERE id = ?', [task.lesson_id]);
      let pathName = 'Unknown Path';
      let lessonTitle = 'Unknown Lesson';

      if (lessons.length > 0) {
        lessonTitle = lessons[0].lesson_title;
        const [paths] = await db.query('SELECT name FROM paths WHERE id = ?', [lessons[0].path_id]);
        if (paths.length > 0) {
          pathName = paths[0].name;
        }
      }

      // Create detailed notification message
      const notificationMessage = `${users[0].name} has uploaded a submission for task "${task.title}" (${task.type.charAt(0).toUpperCase() + task.type.slice(1)}) in lesson "${lessonTitle}" from path "${pathName}".`;

      // Notify all admins about the submission
      await notifyAdmins(
        'task_submission',
        'New Task Submission! 📤',
        notificationMessage,
        null, // Remove link
        {
          taskId: id,
          userId,
          submissionId: result.insertId,
          fileName: req.file.originalname,
          taskTitle: task.title,
          taskType: task.type,
          lessonTitle,
          pathName
        }
      );

      // Emit live event for Admin graph update
      io.emit('task:submission_uploaded', { taskId: id });

      // Send email to admins with detailed info
      const [admins] = await db.query('SELECT email FROM users WHERE role = ?', ['admin']);
      for (const admin of admins) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
            <h2 style="color: #333;">New Task Submission! 📤</h2>
            <p>Hello,</p>
            <p>A student has submitted a task:</p>
            <p><strong>Student:</strong> ${users[0].name}</p>
            <p><strong>Task:</strong> ${task.title}</p>
            <p><strong>Type:</strong> ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</p>
            <p><strong>Lesson:</strong> ${lessonTitle}</p>
            <p><strong>Path:</strong> ${pathName}</p>
            <p><strong>File:</strong> ${req.file.originalname}</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">Please review the submission in the platform.</p>
          </div>
        `;
        await sendEmail(admin.email, 'New Task Submission! 📤', emailHtml);
      }
    }

    res.status(201).json({
      id: result.insertId,
      message: 'Submission uploaded successfully',
      fileName: req.file.originalname
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload submission' });
  }
});

// Get Task Submissions (Admin)
app.get('/tasks/:id/submissions', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // If admin, mark as viewed
    if (req.user && req.user.role === 'admin') {
      await db.query('UPDATE task_submissions SET is_viewed = TRUE WHERE task_id = ?', [id]);
    }

    const [rows] = await db.query(
      `SELECT s.*, u.name as user_name, u.email as user_email 
       FROM task_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.task_id = ?
       ORDER BY s.submitted_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Download Submission File by ID (with student name in filename)
app.get('/submissions/download/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT s.file_name, s.file_path, u.name as user_name 
       FROM task_submissions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = rows[0];
    const filePath = path.join(uploadsDir, submission.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const studentName = submission.user_name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const downloadName = `${studentName}-${submission.file_name}`;

    res.download(filePath, downloadName);
  } catch (err) {
    console.error('[Download] Error:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download Submission File by filename (legacy/fallback)
app.get('/submissions/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath);
});

// Delete Submission
app.delete('/submissions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Get submission details first
    const [submissions] = await db.query('SELECT * FROM task_submissions WHERE id = ?', [id]);

    if (submissions.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissions[0];

    // Check permissions: Owner or Admin
    if (submission.user_id !== req.user.id) {
      const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
      if (userRows.length === 0 || userRows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this submission' });
      }
    }

    // NEW: Prevent deletion if approved (unless admin, maybe? User said "student cant delete", usually admin can do anything. 
    // But let's stick to "if approved, it's final" logic for now, or allow admin to delete.
    // The user said "student cant delete them". Safest is to allow Admin to delete, but Student cannot.
    // Let's refine the check above or add a specific one.

    // If user is NOT admin (meaning it's the student owner), check status
    // We already checked ownership or admin above. Now we need to know if it's admin specifically to bypass this check.
    const [currentUser] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    const isRequestAdmin = currentUser.length > 0 && currentUser[0].role === 'admin';

    if (!isRequestAdmin && submission.status === 'approved') {
      return res.status(403).json({ error: 'Cannot delete an approved submission.' });
    }

    // Delete file from filesystem
    if (submission.file_path) {
      const filePath = path.join(uploadsDir, submission.file_path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('[Delete Submission] Failed to delete file:', e);
          // Continue deleting the record even if file deletion fails
        }
      }
    }

    // Delete from database
    await db.query('DELETE FROM task_submissions WHERE id = ?', [id]);

    res.json({ message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('[Delete Submission] Error:', err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Approve Submission
app.post('/submissions/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get submission details
    const [submissions] = await db.query('SELECT * FROM task_submissions WHERE id = ?', [id]);
    if (submissions.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const submission = submissions[0];

    // Update submission status
    await db.query("UPDATE task_submissions SET status = 'approved' WHERE id = ?", [id]);

    // Mark task as completed for the user in user_progress
    // Check if tasks is already completed
    const [progress] = await db.query(
      "SELECT * FROM user_progress WHERE user_id = ? AND entity_type = 'task' AND entity_id = ?",
      [submission.user_id, submission.task_id]
    );

    if (progress.length === 0) {
      await db.query(
        "INSERT INTO user_progress (user_id, entity_type, entity_id) VALUES (?, 'task', ?)",
        [submission.user_id, submission.task_id]
      );
    }

    // Notify the user
    const [task] = await db.query('SELECT title FROM tasks WHERE id = ?', [submission.task_id]);
    const taskTitle = task.length > 0 ? task[0].title : 'Task';

    await createNotification(
      submission.user_id,
      'submission_approved',
      'Submission Approved! ✅',
      `Your submission for "${taskTitle}" has been approved! The next step is now unlocked.`,
      null,
      { taskId: submission.task_id, submissionId: id }
    );

    // Send Email
    const [student] = await db.query('SELECT email, name FROM users WHERE id = ?', [submission.user_id]);
    if (student.length > 0) {
      await sendNotificationEmail(
        student[0].email,
        'Submission Approved! ✅',
        `Hello <strong>${student[0].name}</strong>!<br><br>
            Great news! Your submission for task <strong>"${taskTitle}"</strong> has been approved by an administrator.<br>
            You can now proceed to the next task in your learning path.`
      );
    }

    // Emit Socket.IO events for live updates
    // 1. Notify all users about leaderboard change
    io.emit('leaderboard:update');

    // 2. Notify about task completion for this specific user
    io.emit('task:completed', {
      userId: submission.user_id,
      taskId: submission.task_id
    });

    res.json({ message: 'Submission approved successfully' });
  } catch (err) {
    console.error('[Approve Submission] Error:', err);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

// Approve All Submissions for a user and task
app.post('/tasks/:taskId/approve-all', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { studentId } = req.body;

  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  try {
    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get task info first
    const [taskRows] = await db.query('SELECT title, type, xp_reward FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const task = taskRows[0];
    const taskTitle = task.title;
    const isMandatory = task.type === 'mandatory';
    const xpReward = task.xp_reward || 0;

    // Update all submissions for this user and task to approved
    await db.query(
      "UPDATE task_submissions SET status = 'approved' WHERE task_id = ? AND user_id = ?",
      [taskId, studentId]
    );

    // Mark task as completed for the user in user_progress
    const [progress] = await db.query(
      "SELECT * FROM user_progress WHERE user_id = ? AND entity_type = 'task' AND entity_id = ?",
      [studentId, taskId]
    );

    if (progress.length === 0) {
      await db.query(
        "INSERT INTO user_progress (user_id, entity_type, entity_id) VALUES (?, 'task', ?)",
        [studentId, taskId]
      );

      // Grant Stars
      if (xpReward > 0) {
        await db.query("UPDATE users SET stars = stars + ? WHERE id = ?", [xpReward, studentId]);
      }
    }

    // Notify the user
    await createNotification(
      studentId,
      'submission_approved',
      'Task Approved! ✅',
      `Your submissions for "${taskTitle}" have been approved! ${isMandatory ? 'The next step is now unlocked.' : 'XP has been granted.'}`,
      null,
      { taskId }
    );

    // Send Email
    const [student] = await db.query('SELECT email, name FROM users WHERE id = ?', [studentId]);
    if (student.length > 0) {
      await sendNotificationEmail(
        student[0].email,
        'Task Approved! ✅',
        `Hello <strong>${student[0].name}</strong>!<br><br>
            Great news! Your submissions for task <strong>"${taskTitle}"</strong> have been approved by an administrator.<br>
            You can now proceed to the next task in your learning path.`
      );
    }

    // Emit Socket.IO events for live updates
    io.emit('leaderboard:update');
    io.emit('task:completed', {
      userId: parseInt(studentId),
      taskId: parseInt(taskId)
    });

    res.json({ message: 'All submissions approved successfully' });
  } catch (err) {
    console.error('[Approve All] Error:', err);
    res.status(500).json({ error: 'Failed to approve submissions' });
  }
});

// Reject all submissions for a task (Admin only)
app.post('/tasks/:taskId/reject-all', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { studentId, comment } = req.body;

  if (!studentId) return res.status(400).json({ error: 'Student ID required' });
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'Rejection comment required' });

  try {
    // Check if user is admin
    const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get task info first
    const [taskRows] = await db.query('SELECT title FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const taskTitle = taskRows[0].title;

    // Update all submissions for this user and task to rejected
    await db.query(
      "UPDATE task_submissions SET status = 'rejected' WHERE task_id = ? AND user_id = ?",
      [taskId, studentId]
    );

    // Notify the user with the rejection comment
    await createNotification(
      studentId,
      'submission_rejected',
      'Task Rejected ❌',
      `Your submissions for "${taskTitle}" were rejected. Reason: ${comment.trim()}`,
      null,
      { taskId, comment: comment.trim() }
    );

    // Send Email with detailed rejection reason
    const [student] = await db.query('SELECT email, name FROM users WHERE id = ?', [studentId]);
    if (student.length > 0) {
      await sendNotificationEmail(
        student[0].email,
        'Task Rejected ❌',
        `Hello <strong>${student[0].name}</strong>!<br><br>
            Your submissions for task <strong>"${taskTitle}"</strong> have been reviewed and rejected by an administrator.<br><br>
            <strong>Reason:</strong><br>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #ef4444;">
              ${comment.trim().replace(/\n/g, '<br>')}
            </div><br>
            Please review the feedback and resubmit your work when ready.`
      );
    }

    // Emit Socket.IO event for live updates
    io.emit('task:rejected', {
      userId: parseInt(studentId),
      taskId: parseInt(taskId)
    });

    res.json({ message: 'All submissions rejected successfully' });
  } catch (err) {
    console.error('[Reject All] Error:', err);
    res.status(500).json({ error: 'Failed to reject submissions' });
  }
});

// Upload Image for Task Description
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  // Return the relative path to access the uploaded image
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// ==================== CHAT ENDPOINTS ====================

// Get all chats for current user
app.get('/chats', authenticateToken, async (req, res) => {
  try {
    const [chats] = await db.query(`
      SELECT DISTINCT c.id, c.name, c.created_by, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM chats c
      INNER JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = ?
      ORDER BY last_message_at DESC, c.updated_at DESC
    `, [req.user.id]);

    res.json(chats);
  } catch (error) {
    console.error('[Chat] Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create new chat
app.post('/chats', authenticateToken, async (req, res) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    // Create chat
    const [result] = await db.query(
      'INSERT INTO chats (name, created_by) VALUES (?, ?)',
      [name.trim(), req.user.id]
    );

    const chatId = result.insertId;

    // Add creator as member
    await db.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)',
      [chatId, req.user.id]
    );

    // Add other members if provided
    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      const values = memberIds.filter(id => id !== req.user.id).map(id => [chatId, id]);
      if (values.length > 0) {
        await db.query(
          'INSERT INTO chat_members (chat_id, user_id) VALUES ?',
          [values]
        );
      }
    }

    // Get created chat with details
    const [chats] = await db.query(
      'SELECT * FROM chats WHERE id = ?',
      [chatId]
    );

    // Notify all members via Socket.IO
    io.emit('chat_created', { chatId: parseInt(chatId), chat: chats[0] });

    res.status(201).json(chats[0]);
  } catch (error) {
    console.error('[Chat] Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Update chat (rename)
app.put('/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    // Check if user is member of chat
    const [members] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    await db.query(
      'UPDATE chats SET name = ? WHERE id = ?',
      [name.trim(), chatId]
    );

    // Get updated chat
    const [chats] = await db.query('SELECT * FROM chats WHERE id = ?', [chatId]);

    // Notify all members via Socket.IO
    io.emit('chat_updated', { chatId: parseInt(chatId), chat: chats[0] });

    res.json(chats[0]);
  } catch (error) {
    console.error('[Chat] Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Delete chat
app.delete('/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;

    // Check if user is the creator
    const [chats] = await db.query(
      'SELECT * FROM chats WHERE id = ? AND created_by = ?',
      [chatId, req.user.id]
    );

    if (chats.length === 0) {
      return res.status(403).json({ error: 'Only chat creator can delete the chat' });
    }

    await db.query('DELETE FROM chats WHERE id = ?', [chatId]);

    // Notify all members via Socket.IO
    io.emit('chat_deleted', { chatId: parseInt(chatId) });

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('[Chat] Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Get chat members
app.get('/chats/:id/members', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;

    // Check if user is member of chat
    const [isMember] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );

    if (isMember.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const [members] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_url, cm.joined_at
      FROM chat_members cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
      ORDER BY cm.joined_at ASC
    `, [chatId]);

    res.json(members);
  } catch (error) {
    console.error('[Chat] Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add member to chat
app.post('/chats/:id/members', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if requester is member of chat
    const [isMember] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );

    if (isMember.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Add new member
    await db.query(
      'INSERT IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)',
      [chatId, userId]
    );

    // Get added user details
    const [users] = await db.query(
      'SELECT id, name, email, role, avatar_url FROM users WHERE id = ?',
      [userId]
    );

    // Notify all members via Socket.IO
    io.emit('member_added', { chatId: parseInt(chatId), user: users[0] });

    res.json({ message: 'Member added successfully', user: users[0] });
  } catch (error) {
    console.error('[Chat] Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member from chat
app.delete('/chats/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const userIdToRemove = req.params.userId;

    // Check if chat exists and get creator
    const [chats] = await db.query('SELECT created_by FROM chats WHERE id = ?', [chatId]);
    if (chats.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only creator or the user themselves can remove a member
    if (req.user.id !== chats[0].created_by && req.user.id != userIdToRemove) {
      return res.status(403).json({ error: 'Not authorized to remove this member' });
    }

    await db.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userIdToRemove]
    );

    // Notify all members via Socket.IO
    io.emit('member_removed', { chatId: parseInt(chatId), userId: userIdToRemove });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('[Chat] Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get messages from chat
app.get('/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Check if user is member of chat
    const [isMember] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );

    if (isMember.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const [messages] = await db.query(`
      SELECT m.*, u.name as user_name, u.avatar_url as user_avatar, u.role as user_role
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [chatId, limit, offset]);

    res.json(messages.reverse()); // Reverse to get chronological order
  } catch (error) {
    console.error('[Chat] Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
app.post('/chats/:id/messages', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const chatId = req.params.id;
    const { content } = req.body;
    const files = req.files || [];

    if ((!content || !content.trim()) && files.length === 0) {
      return res.status(400).json({ error: 'Message content or images are required' });
    }

    // Check if user is member of chat
    const [isMember] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );

    if (isMember.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Prepare image paths
    const imagePaths = files.map(file => `/uploads/${file.filename}`);
    const imagesJSON = imagePaths.length > 0 ? JSON.stringify(imagePaths) : null;

    // Insert message
    const [result] = await db.query(
      'INSERT INTO messages (chat_id, user_id, content, images) VALUES (?, ?, ?, ?)',
      [chatId, req.user.id, content ? content.trim() : '', imagesJSON]
    );

    // Get message with user details
    const [messages] = await db.query(`
      SELECT m.*, u.name as user_name, u.avatar_url as user_avatar, u.role as user_role
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);

    // Emit to all clients via Socket.IO
    console.log('[Socket.IO] Emitting new_message:', { chatId: parseInt(chatId), messageId: messages[0].id });
    io.emit('new_message', { chatId: parseInt(chatId), message: messages[0] });

    res.status(201).json(messages[0]);
  } catch (error) {
    console.error('[Chat] Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit message
app.put('/chats/:chatId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if message exists and user owns it
    const [messages] = await db.query(
      'SELECT * FROM messages WHERE id = ? AND chat_id = ? AND user_id = ?',
      [messageId, chatId, req.user.id]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    // Update message
    await db.query(
      'UPDATE messages SET content = ? WHERE id = ?',
      [content.trim(), messageId]
    );

    // Get updated message with user details
    const [updatedMessages] = await db.query(`
      SELECT m.*, u.name as user_name, u.avatar_url as user_avatar, u.role as user_role
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [messageId]);

    // Emit to all clients via Socket.IO
    io.emit('message_edited', { chatId: parseInt(chatId), message: updatedMessages[0] });

    res.json(updatedMessages[0]);
  } catch (error) {
    console.error('[Chat] Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
app.delete('/chats/:chatId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    // Check if message exists and user owns it
    const [messages] = await db.query(
      'SELECT * FROM messages WHERE id = ? AND chat_id = ? AND user_id = ?',
      [messageId, chatId, req.user.id]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    // Delete message
    await db.query('DELETE FROM messages WHERE id = ?', [messageId]);

    // Emit to all clients via Socket.IO
    io.emit('message_deleted', { chatId: parseInt(chatId), messageId: parseInt(messageId) });

    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ==================== END CHAT ENDPOINTS ====================

// Socket.IO - Real-time Online Presence
io.on('connection', (socket) => {

  // Handle request for current online users
  socket.on('request_online_users', () => {
    const onlineUsersList = Array.from(onlineUsers.values()).map(u => ({
      id: u.id,
      name: u.name,
      avatar_url: u.avatar_url
    }));
    socket.emit('online_users_update', onlineUsersList);
  });

  // Handle user going online
  socket.on('user_online', async (userId) => {
    try {
      // Get user info from database
      const [users] = await db.query('SELECT id, name, avatar_url FROM users WHERE id = ?', [userId]);
      if (users.length > 0) {
        const user = users[0];
        onlineUsers.set(userId.toString(), {
          socketId: socket.id,
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url
        });

        // Broadcast updated online users list to all clients
        const onlineUsersList = Array.from(onlineUsers.values()).map(u => ({
          id: u.id,
          name: u.name,
          avatar_url: u.avatar_url
        }));
        io.emit('online_users_update', onlineUsersList);
      }
    } catch (error) {
      console.error('[Socket.IO] Error setting user online:', error);
    }
  });

  // Handle typing indicator
  socket.on('user_typing', (data) => {
    const { chatId, userId, userName } = data;
    socket.broadcast.emit('user_typing', { chatId, userId, userName });
  });

  socket.on('user_stopped_typing', (data) => {
    const { chatId, userId } = data;
    socket.broadcast.emit('user_stopped_typing', { chatId, userId });
  });

  // Handle user going offline (disconnect)
  socket.on('disconnect', () => {
    // Find and remove user by socketId
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userId);

        // Broadcast updated online users list to all clients
        const onlineUsersList = Array.from(onlineUsers.values()).map(u => ({
          id: u.id,
          name: u.name,
          avatar_url: u.avatar_url
        }));
        io.emit('online_users_update', onlineUsersList);
        break;
      }
    }
  });
});

// API endpoint to get current online users
app.get('/online-users', (req, res) => {
  const onlineUsersList = Array.from(onlineUsers.values()).map(u => ({
    id: u.id,
    name: u.name,
    avatar_url: u.avatar_url
  }));
  res.json(onlineUsersList);
});

// Start Server
(async () => {
  await ensureUsersAvatarUrlColumn();
  await ensureMessagesImagesColumn();
  await ensureChatTables();
  await ensureSubmissionStatusColumn();
  await ensureSubmissionViewedColumn();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();