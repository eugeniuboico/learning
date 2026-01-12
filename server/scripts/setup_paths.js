const db = require('../db');

async function setupPaths() {
  try {
    console.log('[DB] Setting up paths system...');

    // 1. Check if paths table exists, if not create it
    await db.query(`
      CREATE TABLE IF NOT EXISTS paths (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        stars_required INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] ✓ Paths table ready');

    // 2. Add stars_required column if it doesn't exist
    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paths' AND COLUMN_NAME = 'stars_required'"
    );
    if (columns.length === 0) {
      await db.query("ALTER TABLE paths ADD COLUMN stars_required INT DEFAULT 0");
      console.log('[DB] ✓ Added stars_required column to paths');
    }

    // 3. Create user_paths table (tracks which paths each user has unlocked)
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_paths (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        path_id INT NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_path_unique (user_id, path_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE
      )
    `);
    console.log('[DB] ✓ User_paths table ready');

    // 4. Insert default paths if they don't exist
    const [existingPaths] = await db.query('SELECT * FROM paths');
    
    if (existingPaths.length === 0) {
      await db.query(`
        INSERT INTO paths (name, description, stars_required) VALUES
        ('HTML + CSS', 'Learn the fundamentals of web development with HTML and CSS', 0),
        ('Java Script', 'Master JavaScript programming and build interactive web applications', 3000)
      `);
      console.log('[DB] ✓ Inserted default paths');
    } else {
      console.log('[DB] ✓ Default paths already exist');
    }

    // 5. Ensure lessons table has path_id column
    const [lessonColumns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lessons' AND COLUMN_NAME = 'path_id'"
    );
    if (lessonColumns.length === 0) {
      await db.query("ALTER TABLE lessons ADD COLUMN path_id INT NULL");
      await db.query("ALTER TABLE lessons ADD FOREIGN KEY (path_id) REFERENCES paths(id) ON DELETE CASCADE");
      console.log('[DB] ✓ Added path_id to lessons table');
    }

    console.log('[DB] ✅ Paths system setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('[DB] ❌ Error setting up paths:', error);
    process.exit(1);
  }
}

setupPaths();

