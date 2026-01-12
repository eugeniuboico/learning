const db = require('../db');

async function updateSchema() {
  try {
    const connection = await db.getConnection();
    console.log('Updating schema...');

    // 1. Add parent_id column
    try {
      await connection.query(`ALTER TABLE lessons ADD COLUMN parent_id INT DEFAULT NULL`);
    } catch (e) {
      console.log('Column parent_id might already exist, skipping add.');
    }

    // 2. Clear existing lessons to avoid conflicts with new logic (Optional, but safer for dev)
    // await connection.query('DELETE FROM tasks');
    // await connection.query('DELETE FROM lessons');
    
    console.log('Schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

updateSchema();

