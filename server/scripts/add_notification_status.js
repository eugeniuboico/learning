const db = require('../db');

async function addNotificationStatus() {
  try {
    console.log('Adding notification status column...');

    // Check if column exists
    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'status'"
    );

    if (columns.length === 0) {
      // Add status column
      await db.query(`
        ALTER TABLE notifications 
        ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
      `);
      console.log('✅ Notification status column added!');
    } else {
      console.log('✅ Status column already exists!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding notification status:', error);
    process.exit(1);
  }
}

addNotificationStatus();
