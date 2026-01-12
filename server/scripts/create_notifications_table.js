const db = require('../db');

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('account_approved', 'account_rejected', 'new_task', 'task_submission', 'task_graded') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(512) NULL,
        is_read BOOLEAN DEFAULT FALSE,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_read (user_id, is_read),
        INDEX idx_created (created_at)
      )
    `);

    console.log('✅ Notifications table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
    process.exit(1);
  }
}

createNotificationsTable();
