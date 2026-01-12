const mysql = require('mysql2/promise');
require('dotenv').config();

async function createUserTaskViewsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'learning'
  });

  try {
    console.log('📋 Creating user_task_views table...');

    // Create table
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ Table user_task_views created successfully!');

    // Mark all existing tasks as viewed (not new) for current students
    console.log('📝 Marking existing tasks as already viewed...');
    
    const [students] = await connection.execute(`
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN user_paths up ON u.id = up.user_id
      WHERE u.role = 'student' AND u.is_approved = TRUE
    `);

    const [tasks] = await connection.execute('SELECT id FROM tasks');

    if (students.length > 0 && tasks.length > 0) {
      const values = [];
      for (const student of students) {
        for (const task of tasks) {
          values.push([student.id, task.id, new Date()]); // Mark as viewed (old tasks)
        }
      }

      if (values.length > 0) {
        await connection.query(`
          INSERT IGNORE INTO user_task_views (user_id, task_id, viewed_at)
          VALUES ?
        `, [values]);

        console.log(`✅ Marked ${values.length} existing task-student combinations as viewed`);
      }
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createUserTaskViewsTable().catch(console.error);
