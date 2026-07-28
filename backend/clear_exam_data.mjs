import pool from './db.js';

async function clearExamData() {
  try {
    console.log('Clearing exam operational data...');
    await pool.query(`
      TRUNCATE TABLE 
        duty_swap_request,
        invigilator_assignment,
        exam_schedule,
        question_paper,
        rubric,
        student_submission,
        exam_result,
        user_notification,
        exam
      RESTART IDENTITY CASCADE;
    `);
    console.log('Successfully cleared all exam data, schedules, swap requests, uploaded papers, and notifications!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing exam data:', error);
    process.exit(1);
  }
}

clearExamData();
