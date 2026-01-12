const db = require('../db');

async function updateTaskSchema() {
  try {
    const connection = await db.getConnection();
    console.log('Updating tasks schema...');

    // Add position columns to tasks
    try {
      await connection.query(`ALTER TABLE tasks ADD COLUMN position_x INT DEFAULT 0`);
      await connection.query(`ALTER TABLE tasks ADD COLUMN position_y INT DEFAULT 0`);
    } catch (e) {
      console.log('Columns might already exist, skipping.');
    }
    
    console.log('Tasks schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

updateTaskSchema();

