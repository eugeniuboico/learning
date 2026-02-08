USE learning;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM(
    'account_approved',
    'account_rejected',
    'new_task',
    'task_submission',
    'task_graded',
    'new_user_pending',
    'submission_approved',
    'submission_rejected',
    'stars_received',
    'path_unlocked'
  ) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(512),
  metadata JSON,
  status ENUM('unread','read') DEFAULT 'unread',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Task Views table
CREATE TABLE IF NOT EXISTS user_task_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  task_id INT NOT NULL,
  viewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_task (user_id, task_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add missing columns to task_submissions (if not exist)
-- The server auto-creates these at startup, but just in case:
-- status column
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'learning' AND TABLE_NAME = 'task_submissions' AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists = 0, "ALTER TABLE task_submissions ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'", 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- is_viewed column
SET @col_exists2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'learning' AND TABLE_NAME = 'task_submissions' AND COLUMN_NAME = 'is_viewed');
SET @sql2 = IF(@col_exists2 = 0, 'ALTER TABLE task_submissions ADD COLUMN is_viewed BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Create default admin user (password: admin123)
-- You can change the password after login
INSERT IGNORE INTO users (name, email, password, role, is_approved) VALUES
  ('Admin', 'admin@learning.dev', '$2b$10$J8SwzRG8ETCgaqXZ/qyVp.9i2IvzLFxEk32d4ECoa4fPP1G9UK65W', 'admin', TRUE);

SHOW TABLES;
