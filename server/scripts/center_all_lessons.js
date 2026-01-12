const db = require('../db');

async function centerAllLessons() {
  try {
    const connection = await db.getConnection();
    console.log('Recentering all lessons to standard Y position...');

    const standardY = 250; // Same as getCenterY() in frontend

    // Get all lessons grouped by path
    const [lessons] = await connection.query('SELECT id, path_id, position_y FROM lessons ORDER BY path_id, order_index');
    
    if (lessons.length === 0) {
      console.log('No lessons found.');
      process.exit(0);
    }

    console.log(`Found ${lessons.length} lessons. Updating...`);

    // Update each lesson's Y position to the standard center
    for (const lesson of lessons) {
      await connection.query('UPDATE lessons SET position_y = ? WHERE id = ?', [standardY, lesson.id]);
      console.log(`Updated lesson ${lesson.id} from Y=${lesson.position_y} to Y=${standardY}`);
    }

    // Also update tasks Y positions relative to their lessons
    const [tasks] = await connection.query(`
      SELECT t.id, t.lesson_id, t.position_y, t.order_index, l.order_index as lesson_order
      FROM tasks t
      JOIN lessons l ON t.lesson_id = l.id
    `);

    for (const task of tasks) {
      const isUpDirection = task.lesson_order % 2 !== 0; 
      const directionMultiplier = isUpDirection ? -1 : 1;
      const taskSpacingY = 120;
      
      if (task.order_index === 1) {
        // First task: diagonal from lesson
        const newTaskY = standardY + (taskSpacingY * directionMultiplier);
        await connection.query('UPDATE tasks SET position_y = ? WHERE id = ?', [newTaskY, task.id]);
        console.log(`Updated task ${task.id} (first) to Y=${newTaskY}`);
      } else {
        // Subsequent tasks: Get previous task's Y
        const [prevTask] = await connection.query(
          'SELECT position_y FROM tasks WHERE lesson_id = ? AND order_index = ?',
          [task.lesson_id, task.order_index - 1]
        );
        if (prevTask.length > 0) {
          const newTaskY = prevTask[0].position_y; // Same Y as previous
          await connection.query('UPDATE tasks SET position_y = ? WHERE id = ?', [newTaskY, task.id]);
          console.log(`Updated task ${task.id} (order ${task.order_index}) to Y=${newTaskY}`);
        }
      }
    }

    console.log('All lessons and tasks have been centered successfully!');
    console.log('Please refresh your browser to see the changes.');
    process.exit(0);
  } catch (error) {
    console.error('Error centering lessons:', error);
    process.exit(1);
  }
}

centerAllLessons();

