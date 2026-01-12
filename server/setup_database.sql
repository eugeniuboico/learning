-- ================================================
-- LEARNING PLATFORM - DATABASE SETUP SCRIPT
-- ================================================
-- This script will create all necessary tables for the learning platform
-- Run this script in your MySQL database named 'learning'

USE learning;

-- ================================================
-- 1. USERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'student') DEFAULT 'student',
  stars INT DEFAULT 0,
  avatar_url VARCHAR(512) NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  login_code VARCHAR(10) NULL,
  login_code_expires DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 2. PATHS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS paths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stars_required INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 3. USER_PATHS TABLE (Tracks unlocked paths)
-- ================================================
CREATE TABLE IF NOT EXISTS user_paths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  path_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_path_unique (user_id, path_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_path_id (path_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 4. LESSONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  path_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  order_index INT NOT NULL,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES lessons(id) ON DELETE SET NULL,
  INDEX idx_path_id (path_id),
  INDEX idx_order (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 5. TASKS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('mandatory', 'optional') DEFAULT 'mandatory',
  xp_reward INT DEFAULT 10,
  deadline DATETIME NULL,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  order_index INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  INDEX idx_lesson_id (lesson_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 6. USER_PROGRESS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS user_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  entity_type ENUM('lesson', 'task') NOT NULL,
  entity_id INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY user_entity_unique (user_id, entity_type, entity_id),
  INDEX idx_user_id (user_id),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 7. TASK_SUBMISSIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS task_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size BIGINT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 8. CHATS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 9. CHAT_MEMBERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chat_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_chat_member (chat_id, user_id),
  INDEX idx_chat_id (chat_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- 10. MESSAGES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  images TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_created (chat_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- INSERT DEFAULT DATA
-- ================================================

-- Insert default paths (HTML+CSS and JavaScript)
INSERT INTO paths (name, description, stars_required) VALUES
  ('HTML + CSS', 'Learn the fundamentals of web development with HTML and CSS', 0),
  ('JavaScript', 'Master JavaScript programming and build interactive web applications', 3000)
ON DUPLICATE KEY UPDATE name=name;

-- ================================================
-- VERIFICATION QUERIES
-- ================================================
-- Run these to verify the setup:

-- Show all tables
SHOW TABLES;

-- Show table structures
-- DESCRIBE users;
-- DESCRIBE paths;
-- DESCRIBE lessons;
-- DESCRIBE tasks;
-- DESCRIBE user_progress;
-- DESCRIBE chats;
-- DESCRIBE messages;

-- ================================================
-- SETUP COMPLETE!
-- ================================================
-- Your database is now ready to use.
-- 
-- NEXT STEPS:
-- 1. Create a .env file in the server directory with:
--    DB_HOST=localhost
--    DB_USER=root
--    DB_PASSWORD=your_password
--    DB_NAME=learning
--    JWT_SECRET=your_secret_key
--    EMAIL_USER=your_email@gmail.com
--    EMAIL_PASS=your_app_password
--
-- 2. Start the server: cd server && npm install && node index.js
-- 3. Start the client: cd client && npm install && npm run dev
-- 4. Create an admin user by registering and then running:
--    node server/scripts/promote_admin.js your_email@example.com
