const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔧 Starting database setup...\n');
    
    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });
    
    console.log('✓ Connected to MySQL server');
    
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'learning';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✓ Database '${dbName}' ready`);
    
    // Use the database
    await connection.query(`USE ${dbName}`);
    
    // Read and execute SQL file
    const sqlFile = path.join(__dirname, '../setup_database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('\n📝 Executing SQL setup script...');
    await connection.query(sql);
    
    console.log('\n✅ Database setup completed successfully!\n');
    
    // Show created tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 Created tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    console.log('\n🎉 Your database is ready to use!\n');
    console.log('📌 Next steps:');
    console.log('   1. Make sure you have a .env file in the server directory');
    console.log('   2. Start the server: node index.js');
    console.log('   3. Register a user in the application');
    console.log('   4. Promote user to admin: node scripts/promote_admin.js your_email@example.com\n');
    
  } catch (error) {
    console.error('\n❌ Error setting up database:', error.message);
    console.error('\nPlease check:');
    console.error('   - MySQL server is running');
    console.error('   - Database credentials in .env file are correct');
    console.error('   - User has permission to create databases\n');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
setupDatabase();
