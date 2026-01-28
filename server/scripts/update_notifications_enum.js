const db = require('../db');

async function updateNotificationsEnum() {
  try {
    console.log('📋 Updating notifications enum to include all types...');

    // Update the enum to include all notification types used in the application
    await db.query(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM(
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
      ) NOT NULL
    `);

    console.log('✅ Notifications enum updated successfully!');
    console.log('Available notification types:');
    console.log('  - account_approved');
    console.log('  - account_rejected');
    console.log('  - new_task');
    console.log('  - task_submission');
    console.log('  - task_graded');
    console.log('  - new_user_pending');
    console.log('  - submission_approved');
    console.log('  - submission_rejected');
    console.log('  - stars_received');
    console.log('  - path_unlocked');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating notifications enum:', error);
    process.exit(1);
  }
}

updateNotificationsEnum();
