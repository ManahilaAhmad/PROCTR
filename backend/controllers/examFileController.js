import pool from '../db.js';

/* ===========================================================
   UPLOAD EXAM ATTACHMENT (question_paper, rubric, starter_file, word_template)
=========================================================== */
export const uploadExamFile = async (req, res) => {
  const { exam_id, file_type } = req.body;

  if (!exam_id || !file_type) {
    return res.status(400).json({ status: 'error', message: 'exam_id and file_type are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file was uploaded.' });
  }

  const validTypes = ['question_paper', 'rubric', 'starter_file', 'word_template'];
  if (!validTypes.includes(file_type)) {
    return res.status(400).json({ status: 'error', message: `Invalid file_type. Must be one of: ${validTypes.join(', ')}` });
  }

  const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${req.file.filename}`;
  const originalName = req.file.originalname;

  try {
    const teacherRes = await pool.query(`
      SELECT co.teacher_id
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      WHERE e.exam_id = $1
    `, [exam_id]);

    const teacherId = teacherRes.rows[0]?.teacher_id || 1;

    // Record in exam_file table
    const result = await pool.query(`
      INSERT INTO exam_file (exam_id, file_type, file_path, original_name, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [exam_id, file_type, fileUrl, originalName, teacherId]);

    // Also update legacy/convenience table & columns if applicable
    if (file_type === 'question_paper') {
      await pool.query(`
        INSERT INTO question_paper (exam_id, uploaded_by, file_path, version)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT DO NOTHING
      `, [exam_id, teacherId, fileUrl]);
    } else if (file_type === 'rubric') {
      await pool.query(`
        INSERT INTO rubric (exam_id, uploaded_by, file_path, version)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT DO NOTHING
      `, [exam_id, teacherId, fileUrl]);
    } else if (file_type === 'word_template') {
      await pool.query('UPDATE exam SET word_template_path = $1 WHERE exam_id = $2', [fileUrl, exam_id]);
    } else if (file_type === 'starter_file') {
      await pool.query('UPDATE exam SET starter_files_path = $1 WHERE exam_id = $2', [fileUrl, exam_id]);
    }

    res.status(200).json({ status: 'success', message: `${file_type} uploaded successfully.`, file: result.rows[0] });
  } catch (error) {
    console.error('Error uploading exam file:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload file attachment.' });
  }
};

/* ===========================================================
   GET ALL FILES ATTACHED TO AN EXAM
=========================================================== */
export const getExamFiles = async (req, res) => {
  const { examId } = req.params;
  try {
    const result = await pool.query(`
      SELECT exam_file_id, file_type, file_path, original_name, uploaded_at
      FROM exam_file
      WHERE exam_id = $1
      ORDER BY uploaded_at DESC
    `, [examId]);

    res.status(200).json({ status: 'success', files: result.rows });
  } catch (error) {
    console.error('Error fetching exam files:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch exam files.' });
  }
};

/* ===========================================================
   DELETE AN ATTACHED FILE
=========================================================== */
export const deleteExamFile = async (req, res) => {
  const { examId, fileId } = req.params;
  try {
    await pool.query('DELETE FROM exam_file WHERE exam_id = $1 AND exam_file_id = $2', [examId, fileId]);
    res.status(200).json({ status: 'success', message: 'Exam file removed.' });
  } catch (error) {
    console.error('Error deleting exam file:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete exam file.' });
  }
};
