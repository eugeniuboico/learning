const db = require('../db');

async function checkPaths() {
  try {
    const [paths] = await db.query('SELECT id, name, stars_required FROM paths ORDER BY stars_required ASC');
    console.log('Current paths in database (ordered by stars):');
    console.table(paths);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPaths();

