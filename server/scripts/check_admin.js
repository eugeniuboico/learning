const db = require('../db');

async function checkAdmin() {
  try {
    const [rows] = await db.query('SELECT id, email, role, name FROM users WHERE role = "admin"');
    console.log('Admin users:', rows);
    
    if (rows.length === 0) {
      console.log('\nNo admin found. Creating admin user...');
      const [result] = await db.query(
        "UPDATE users SET role = 'admin' WHERE email = 'eugenboico54@gmail.com'"
      );
      console.log('Admin user created/updated');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAdmin();

