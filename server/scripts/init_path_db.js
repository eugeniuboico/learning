const db = require('../db');

async function createTables() {
  try {
    const connection = await db.getConnection();

    console.log('Creating tables...');

    // Tabela pentru Lectii (Nodes)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        path_id VARCHAR(50) NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        position_x INT DEFAULT 0,
        position_y INT DEFAULT 0,
        order_index INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela pentru Task-uri
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lesson_id INT NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        type ENUM('mandatory', 'optional') DEFAULT 'mandatory',
        xp_reward INT DEFAULT 10,
        deadline DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      )
    `);

    // Tabela pentru Progres (Ce lectii/taskuri a completat userul)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        entity_type ENUM('lesson', 'task') NOT NULL,
        entity_id INT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

createTables();

