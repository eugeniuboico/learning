const db = require('../db');

async function updateTasksSchema() {
  try {
    // Add description column to tasks table
    try {
      await db.query(`
        ALTER TABLE tasks
        ADD COLUMN description TEXT
      `);
      console.log('✓ Added description column to tasks table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ Description column already exists');
      } else {
        throw err;
      }
    }

    // Create task_submissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS task_submissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created task_submissions table');

    console.log('✓ Database schema updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error updating schema:', err);
    process.exit(1);
  }
}

updateTasksSchema();

