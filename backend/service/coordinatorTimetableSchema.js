import pool from '../db.js';

let schemaReady;

export default async function ensureCoordinatorTimetableSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS coordinator_exam_timetable (
        timetable_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        course_offering_id INT NOT NULL REFERENCES course_offering(course_offering_id),
        exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('LabMid','LabFinal','LabPractical')),
        lab_id INT NOT NULL REFERENCES lab(lab_id),
        coordinator_id INT NOT NULL REFERENCES coordinator(coordinator_id),
        exam_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Published' CHECK (status IN ('Published','Cancelled')),
        linked_exam_id INT REFERENCES exam(exam_id),
        linked_schedule_id INT REFERENCES exam_schedule(schedule_id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CHECK (end_time > start_time),
        UNIQUE (linked_exam_id),
        UNIQUE (linked_schedule_id)
      );
      ALTER TABLE coordinator_exam_timetable
        DROP CONSTRAINT IF EXISTS coordinator_exam_timetable_course_offering_id_exam_type_key;
      CREATE UNIQUE INDEX IF NOT EXISTS unique_published_coordinator_exam_timetable
        ON coordinator_exam_timetable (course_offering_id, exam_type)
        WHERE status = 'Published'
    `).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
