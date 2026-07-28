import pool from './db.js';

console.log('=== Testing Notification Visibility for Students ===\n');

// 1. Get student user IDs
const studRes = await pool.query(`SELECT u.user_id, u.first_name FROM users u JOIN student s ON s.user_id = u.user_id`);
console.log('Student users:', studRes.rows);

// 2. For each student, run the exact query the backend runs
for (const stu of studRes.rows) {
  const uid = stu.user_id;
  const audienceTypes = ['AllStudents'];
  const departmentId = null;

  const broadcasts = await pool.query(`
    SELECT ba.announcement_id, ba.subject, ba.audience_type, ba.is_published,
           (nr.notification_read_id IS NOT NULL) AS is_read
    FROM broadcast_announcement ba
    LEFT JOIN users u ON ba.sender_user_id = u.user_id
    LEFT JOIN notification_read nr ON nr.announcement_id = ba.announcement_id AND nr.user_id = $1
    WHERE ba.is_published = TRUE
    AND (
        ba.audience_type = ANY($2::varchar[])
        OR (ba.audience_type = 'Department' AND ba.department_id = $3)
        OR (ba.audience_type = 'Specific' AND ba.target_user_id = $1)
    )
    ORDER BY ba.created_at DESC LIMIT 10
  `, [uid, audienceTypes, departmentId]);

  const personal = await pool.query(`
    SELECT notification_id, title, notification_type, is_read FROM user_notification WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
  `, [uid]);

  console.log(`Student: ${stu.first_name} (user_id=${uid})`);
  console.log(`  Broadcasts: ${broadcasts.rows.length}`, broadcasts.rows.map(r => `${r.subject} [${r.audience_type}]`));
  console.log(`  Personal notifs: ${personal.rows.length}`, personal.rows.map(r => `${r.title} [${r.notification_type}]`));
  console.log('');
}

// 3. Also test student users in student table vs user_notification
const direct = await pool.query(`SELECT un.user_id, un.title, un.notification_type FROM user_notification un JOIN student s ON s.user_id = un.user_id`);
console.log('Direct notifications for students in user_notification:', direct.rows);

await pool.end();
