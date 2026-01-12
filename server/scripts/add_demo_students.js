const db = require('../db');
const bcrypt = require('bcrypt');

async function addDemoStudents() {
  try {
    console.log('Adding demo students...');

    // Parola dummy pentru toți (nu contează, nu te vei loga cu ei)
    const dummyPassword = await bcrypt.hash('demo123', 10);

    const students = [
      { name: 'Alexandru Popescu', email: 'alex.popescu@demo.com', stars: 5200 },
      { name: 'Maria Ionescu', email: 'maria.ionescu@demo.com', stars: 4800 },
      { name: 'Andrei Dumitrescu', email: 'andrei.dumitrescu@demo.com', stars: 4350 },
      { name: 'Elena Georgescu', email: 'elena.georgescu@demo.com', stars: 3900 },
      { name: 'Cristian Popa', email: 'cristian.popa@demo.com', stars: 3500 },
      { name: 'Diana Stoica', email: 'diana.stoica@demo.com', stars: 2800 }
    ];

    for (const student of students) {
      // Verifică dacă există deja
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [student.email]);
      
      if (existing.length === 0) {
        await db.query(
          'INSERT INTO users (name, email, password, role, stars, is_approved) VALUES (?, ?, ?, ?, ?, ?)',
          [student.name, student.email, dummyPassword, 'student', student.stars, true]
        );
        console.log(`✓ Added: ${student.name} (${student.stars} stars)`);
      } else {
        console.log(`- Skipped: ${student.name} (already exists)`);
      }
    }

    console.log('\n✅ Demo students added successfully!');
    console.log('Refresh your app to see them in the leaderboard.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding demo students:', error);
    process.exit(1);
  }
}

addDemoStudents();
