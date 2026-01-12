const db = require('../db');

async function fixJavaScriptStars() {
  try {
    console.log('Updating JavaScript stars from 3000 to 300...');
    await db.query("UPDATE paths SET stars_required = 300 WHERE name = 'Java Script'");
    
    const [paths] = await db.query('SELECT id, name, stars_required FROM paths ORDER BY stars_required ASC');
    console.log('\n✓ Updated! Current paths:');
    console.table(paths);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixJavaScriptStars();

