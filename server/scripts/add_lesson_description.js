const db = require('../db');

async function addLessonDescription() {
  try {
    const connection = await db.getConnection();
    console.log('Adding description column to lessons...');

    try {
      await connection.query(`ALTER TABLE lessons ADD COLUMN description TEXT`);
      console.log('Description column added successfully!');
    } catch (e) {
      console.log('Column might already exist:', e.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addLessonDescription();

