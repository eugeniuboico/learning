const db = require('../db');

async function updateTaskOrderSchema() {
  try {
    const connection = await db.getConnection();
    console.log('Updating tasks schema for ordering...');

    // Add order_index column to tasks if not exists
    try {
      await connection.query(`ALTER TABLE tasks ADD COLUMN order_index INT DEFAULT 1`);
    } catch (e) {
      console.log('Column order_index might already exist.');
    }
    
    console.log('Tasks schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

updateTaskOrderSchema();

