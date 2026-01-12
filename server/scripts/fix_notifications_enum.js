const db = require('../db');

async function fixNotificationsEnum() {
  try {
    console.log('Fixing notifications enum...');

    // Update the enum to include all notification types
    await db.query(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM(
        'account_approved', 
        'account_rejected', 
        'new_task', 
        'task_submission', 
        'task_graded',
        'new_user_pending'
      ) NOT NULL
    `);

    console.log('✅ Notifications enum fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing notifications enum:', error);
    process.exit(1);
  }
}

fixNotificationsEnum();
