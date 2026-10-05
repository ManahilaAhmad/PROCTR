import pool from '../db.js';
import path from 'path';
import { beginSubmissionAttempt, commitSubmissionAttempt, receiptResponse } from '../service/submissionReceipts.js';
import {
  prepareSubmissionFiles, normalizeSubmissionPath, uploadSubmissionAssets,
  deleteSubmissionAssets, readSubmissionAsset
} from '../service/submissionStorage.js';

// Same H-code labels used by the live monitoring feed (desktop_violation_log)
// — kept in sync so a violation reads the same way whether it's live or in
// a downloaded report. NOTE: this reads from desktop_violation_log, which is
// NOT part of schema.sql's proctoring_event table — see conversation notes.
// If/when violations move to proctoring_event, this query needs updating too.
const HUMAN_MAP = {
  'H1': 'USB Hardware Insertion Detected',
  'H2': 'Unauthorized Application / Website Access',
  'H3': 'Window Focus Loss / Away Breach',
  'H4a': 'Clipboard Buffer Violation',
  'H4b': 'Workspace & Document Tampering',
  'H5': 'Unauthorized Domain / DNS Access',
  'N1': 'Unauthorized Network Subnet / Hotspot Breach'
};

// PostgreSQL holds filenames and Cloudinary identifiers, never file contents.
// Old disk submissions must be migrated explicitly; there is no disk fallback.
function requireManifest(row) {
  if (row.submission_manifest?.provider !== 'cloudinary') {
    const error = new Error('This older submission must be migrated to Cloudinary. Run npm run migrate:submissions in the backend.');
    error.status = 409;
    throw error;
  }
  return row.submission_manifest;
}

function listManifestFiles(manifest) {
  return manifest.files.map(({ relative_path, file_size }) => ({ relative_path, file_size }));
}

function sendError(res, error, fallback) {
  return res.status(error.status || 500).json({
    status: 'error', message: error.status ? error.message : fallback
  });
}

async function sendAsset(res, asset, fileName, shouldDownload) {
  const content = await readSubmissionAsset(asset);
  // Express safely encodes filenames in Content-Disposition, including Unicode.
  res.attachment(fileName);
  if (!shouldDownload) {
    res.set('Content-Disposition', res.get('Content-Disposition').replace(/^attachment/, 'inline'));
  }
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.send(content);
}

/* ===========================================================
   Build the standalone, downloadable HTML security log report.
=========================================================== */
function buildSecurityReportHtml({ studentName, regNo, courseLabel, examLabel, violations }) {
  const rows = violations.map(v => {
    const sev = (v.severity || 'HIGH').toUpperCase();
    return `
      <tr class="v-row" data-severity="${sev}">
        <td>${new Date(v.detected_at).toLocaleString()}</td>
        <td><span class="code-pill">${escapeHtml(v.violation_code)}</span></td>
        <td>${escapeHtml(HUMAN_MAP[v.violation_code] || v.title || 'Security Violation')}</td>
        <td><span class="sev-pill sev-${sev}">${sev}</span></td>
        <td>${escapeHtml(v.description || '—')}</td>
      </tr>`;
  }).join('\n');

  const counts = violations.reduce((acc, v) => {
    const sev = (v.severity || 'HIGH').toUpperCase();
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Security Log Report — ${escapeHtml(studentName)} (${escapeHtml(regNo)})</title>
<style>
  :root { --navy:#0f2540; --grey-500:#64748b; --grey-200:#e2e8f0; --red:#dc2626; --orange:#ea580c; --amber:#d97706; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; background:#f8fafc; color:#1e293b; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 32px 24px 60px; }
  header { border-bottom: 3px solid var(--navy); padding-bottom: 18px; margin-bottom: 24px; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
  h1 { font-size: 20px; margin: 0 0 4px; color: var(--navy); }
  .sub { font-size: 13px; color: var(--grey-500); }
  .meta { display:flex; gap:28px; flex-wrap:wrap; margin-bottom: 22px; }
  .meta div { font-size:12px; }
  .meta b { display:block; font-size:13px; color:var(--navy); margin-top:2px; }
  .summary { display:flex; gap:10px; margin-bottom: 20px; flex-wrap: wrap; }
  .summary .pill { border:1px solid var(--grey-200); border-radius:8px; padding:8px 14px; font-size:12px; background:#fff; }
  .summary .pill b { font-size:16px; display:block; }
  .filters { display:flex; gap:8px; margin-bottom: 14px; flex-wrap: wrap; }
  .filters button { border:1px solid var(--grey-200); background:#fff; padding:7px 14px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; color:#334155; }
  .filters button.active { background: var(--navy); color:#fff; border-color: var(--navy); }
  table { width:100%; border-collapse: collapse; background:#fff; border:1px solid var(--grey-200); border-radius:10px; overflow:hidden; }
  th, td { text-align:left; padding:10px 12px; font-size:12.5px; border-bottom:1px solid var(--grey-200); vertical-align: top; }
  th { background:#f1f5f9; text-transform:uppercase; font-size:10.5px; letter-spacing:.04em; color:var(--grey-500); }
  tr:last-child td { border-bottom:none; }
  .code-pill { font-family: monospace; background:#eef2ff; color:#3730a3; padding:2px 7px; border-radius:5px; font-size:11px; font-weight:700; }
  .sev-pill { padding:2px 9px; border-radius:12px; font-size:10.5px; font-weight:700; }
  .sev-CRITICAL { background:#fee2e2; color:var(--red); }
  .sev-HIGH { background:#ffedd5; color:var(--orange); }
  .sev-MEDIUM { background:#fef9c3; color:var(--amber); }
  .sev-LOW { background:#f1f5f9; color:var(--grey-500); }
  .empty { text-align:center; padding:40px; color:var(--grey-500); font-size:13px; }
  .btn-download { border:none; background:var(--navy); color:#fff; padding:9px 18px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; }
  footer { margin-top:24px; font-size:11px; color:var(--grey-500); text-align:center; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>Security Log Report</h1>
        <div class="sub">Generated by PROCTR — behavioural violation record for this exam session</div>
      </div>
      <button class="btn-download" onclick="window.print()">⬇ Save / Print as PDF</button>
    </header>

    <div class="meta">
      <div>Student <b>${escapeHtml(studentName)}</b></div>
      <div>Registration No <b>${escapeHtml(regNo)}</b></div>
      <div>Course <b>${escapeHtml(courseLabel)}</b></div>
      <div>Exam <b>${escapeHtml(examLabel)}</b></div>
      <div>Report Generated <b>${new Date().toLocaleString()}</b></div>
    </div>

    <div class="summary">
      <div class="pill">Total Events<b>${violations.length}</b></div>
      <div class="pill">Critical<b>${counts.CRITICAL || 0}</b></div>
      <div class="pill">High<b>${counts.HIGH || 0}</b></div>
      <div class="pill">Medium<b>${counts.MEDIUM || 0}</b></div>
      <div class="pill">Low<b>${counts.LOW || 0}</b></div>
    </div>

    <div class="filters">
      <button class="active" data-filter="ALL">All</button>
      <button data-filter="CRITICAL">Critical</button>
      <button data-filter="HIGH">High</button>
      <button data-filter="MEDIUM">Medium</button>
      <button data-filter="LOW">Low</button>
    </div>

    ${violations.length === 0 ? '<div class="empty">No security violations were recorded for this student during this exam.</div>' : `
    <table>
      <thead><tr><th>Time</th><th>Code</th><th>Violation</th><th>Severity</th><th>Details</th></tr></thead>
      <tbody id="v-body">
        ${rows}
      </tbody>
    </table>`}

    <footer>PROCTR Secure Exam Proctoring — Automatically generated report. Do not edit.</footer>
  </div>

<script>
  document.querySelectorAll('.filters button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filters button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var filter = btn.dataset.filter;
      document.querySelectorAll('.v-row').forEach(function(row) {
        row.style.display = (filter === 'ALL' || row.dataset.severity === filter) ? '' : 'none';
      });
    });
  });
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ===========================================================
   1. UPLOAD SUBMISSION (called by the Desktop app — auto at
      session end, or manually via the Submit button)
=========================================================== */
export const uploadSubmission = async (req, res) => {
  const { exam_id, student_id, mac_address, files } = req.body;

  if (!exam_id || !student_id) {
    return res.status(400).json({ status: 'error', message: 'exam_id and student_id are required.' });
  }
  if (!Array.isArray(files)) {
    return res.status(400).json({ status: 'error', message: 'files must be an array.' });
  }

  let manifest;
  let committed = false;
  let commitAttempted = false;
  try {
    const preparedFiles = prepareSubmissionFiles(files);
    const attempt = req.body.request_id
      ? await beginSubmissionAttempt(req.body.request_id, student_id, exam_id, preparedFiles) : null;
    if (attempt && attempt.state !== 'pending') return res.status(200).json(receiptResponse(attempt));
    // Resolve the lab (course_offering) + teacher this exam belongs to —
    // derived server-side from exam_id via schema.sql's real relationships,
    // never trusted from the client.
    const examInfo = await pool.query(
      `SELECT co.course_offering_id, co.teacher_id, c.course_code, c.course_title, s.section_name, e.exam_type
       FROM exam e
       JOIN course_offering co ON e.course_offering_id = co.course_offering_id
       JOIN course c ON co.course_id = c.course_id
       JOIN section s ON co.section_id = s.section_id
       WHERE e.exam_id = $1`,
      [exam_id]
    );
    if (examInfo.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam not found — cannot resolve which lab/teacher this belongs to.' });
    }
    const { teacher_id, course_code, course_title, section_name, exam_type } = examInfo.rows[0];

    // Authoritative student identity — never trust a client-supplied reg no.
    const studentInfo = await pool.query(
      `SELECT s.registration_no, COALESCE(u.first_name || ' ' || u.last_name, 'Candidate') AS name
       FROM student s LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.student_id = $1`,
      [student_id]
    );
    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student not found.' });
    }
    const regNo = studentInfo.rows[0].registration_no || `STU${student_id}`;
    const studentName = studentInfo.rows[0].name || 'Candidate';

    // ── Generate the security log report for this student on this exam ──
    // (still reads desktop_violation_log — see note at top of file)
    const violationsRes = await pool.query(
      `SELECT dvl.* FROM desktop_violation_log dvl
       JOIN live_exam_session les ON dvl.session_id = les.live_session_id
       WHERE les.exam_id = $1 AND dvl.student_id = $2
       ORDER BY dvl.detected_at ASC`,
      [exam_id, student_id]
    ).catch(error => {
      // The log table is created when the first event is recorded. Other
      // database errors must retry rather than generate a false clean report.
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });

    const reportHtml = buildSecurityReportHtml({
      studentName,
      regNo,
      courseLabel: `${course_code} — ${course_title} (${section_name})`,
      examLabel: exam_type || 'Lab Exam',
      violations: violationsRes.rows || []
    });
    manifest = await uploadSubmissionAssets({
      examId: exam_id, studentId: student_id, teacherId: teacher_id,
      files: preparedFiles, reportHtml
    });
    if (attempt) {
      // Verify delivery before issuing a receipt; the desktop keeps its backup
      // throughout, including during an uncertain database commit.
      for (const asset of [...manifest.files, manifest.report]) await readSubmissionAsset(asset);
    }

    // ── IP / MAC — both NOT NULL in schema.sql, capture them for real ──
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const ipAddress = String(rawIp).split(',')[0].replace('::ffff:', '').trim() || '0.0.0.0';
    const macAddress = (mac_address && String(mac_address).trim()) || '00:00:00:00:00:00';

    if (attempt) {
      const result = await commitSubmissionAttempt(attempt, manifest, ipAddress, macAddress);
      committed = true;
      res.status(200).json(result.receipt);
      if (result.discardNew) await deleteSubmissionAssets(manifest).catch(() => {});
      return;
    }

    // Each attempt has its own cloud folder. Only replace the database pointer
    // after every upload succeeds, and serialize concurrent submissions.
    const client = await pool.connect();
    let previousManifest;
    let subResult;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`submission:${student_id}:${exam_id}`]);
      const previous = await client.query(
        'SELECT submission_manifest FROM student_submission WHERE student_id = $1 AND exam_id = $2 FOR UPDATE',
        [student_id, exam_id]
      );
      previousManifest = previous.rows[0]?.submission_manifest;
      subResult = await client.query(
        `INSERT INTO student_submission (student_id, exam_id, submission_path, ip_address, mac_address, submission_manifest, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
         ON CONFLICT (student_id, exam_id) DO UPDATE
         SET submission_path = EXCLUDED.submission_path,
             submission_manifest = EXCLUDED.submission_manifest,
             ip_address = EXCLUDED.ip_address,
             mac_address = EXCLUDED.mac_address,
             submitted_at = NOW()
         RETURNING submission_id`,
        [student_id, exam_id, `cloudinary://${manifest.folder}`, ipAddress, macAddress, JSON.stringify(manifest)]
      );
      commitAttempted = true;
      await client.query('COMMIT');
      committed = true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    res.status(200).json({
      status: 'success',
      message: `Submission saved to Cloudinary: ${preparedFiles.length} file(s) uploaded.`,
      submission_id: subResult.rows[0].submission_id,
      file_count: preparedFiles.length
    });
    // Send confirmation before cleanup: a slow deletion must not cause the
    // desktop to time out after the new submission has already been saved.
    if (previousManifest) {
      await deleteSubmissionAssets(previousManifest).catch(() => {
        console.warn('Could not clean up the previous Cloudinary submission.');
      });
    }
  } catch (error) {
    // A dropped connection during COMMIT has an uncertain outcome. Retain the
    // uploaded assets in that case so a committed row cannot lose its files.
    if (manifest && !committed && !commitAttempted && !error.retainAssets) await deleteSubmissionAssets(manifest).catch(() => {});
    console.error('Error uploading submission:', error.message);
    sendError(res, error, 'Could not confirm the submission was saved. Please check your submitted work and retry.');
  }
};

/* ===========================================================
   2. TEACHER — list their "lab" folders (one per course_offering
      they teach), each labeled so two sections of the same course
      never collapse into one folder.
=========================================================== */
export const getTeacherLabs = async (req, res) => {
  const { teacherId } = req.params;
  try {
    const result = await pool.query(
      `SELECT co.course_offering_id, c.course_code, c.course_title, s.section_name,
              COUNT(DISTINCT ss.submission_id) AS submission_count
       FROM course_offering co
       JOIN course c ON co.course_id = c.course_id
       JOIN section s ON co.section_id = s.section_id
       LEFT JOIN exam e ON e.course_offering_id = co.course_offering_id
       LEFT JOIN student_submission ss ON ss.exam_id = e.exam_id
       WHERE co.teacher_id = $1
       GROUP BY co.course_offering_id, c.course_code, c.course_title, s.section_name
       ORDER BY c.course_code ASC`,
      [teacherId]
    );
    res.status(200).json({
      status: 'success',
      labs: result.rows.map(r => ({
        course_offering_id: r.course_offering_id,
        label: `${r.course_code} — ${r.course_title} (${r.section_name})`,
        course_code: r.course_code,
        submission_count: parseInt(r.submission_count, 10) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching teacher labs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch submission labs.' });
  }
};

/* ===========================================================
   3. TEACHER — list students (roll-number subfolders) who have
      submitted within a specific lab (course_offering).
      Ownership verified server-side.
=========================================================== */
export const getLabStudents = async (req, res) => {
  const { teacherId, courseOfferingId } = req.params;
  try {
    const ownerCheck = await pool.query(
      `SELECT teacher_id FROM course_offering WHERE course_offering_id = $1`,
      [courseOfferingId]
    );
    if (ownerCheck.rows.length === 0 || String(ownerCheck.rows[0].teacher_id) !== String(teacherId)) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this lab\'s submissions.' });
    }

    const result = await pool.query(
      `SELECT DISTINCT ON (ss.student_id)
              ss.submission_id, ss.student_id, ss.submitted_at, ss.submission_manifest,
              s.registration_no, COALESCE(u.first_name || ' ' || u.last_name, 'Candidate') AS name
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       JOIN student s ON ss.student_id = s.student_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE e.course_offering_id = $1
       ORDER BY ss.student_id, ss.submitted_at DESC`,
      [courseOfferingId]
    );

    const students = result.rows.map(r => {
      const manifest = r.submission_manifest;
      return {
        submission_id: r.submission_id,
        student_id: r.student_id,
        submitted_at: r.submitted_at,
        registration_no: r.registration_no,
        name: r.name,
        file_count: manifest?.files?.length || 0,
        migration_required: manifest?.provider !== 'cloudinary'
      };
    });

    res.status(200).json({ status: 'success', students });
  } catch (error) {
    console.error('Error fetching lab students:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student submissions.' });
  }
};

/* ===========================================================
   4. TEACHER — files + report for one student's submission
=========================================================== */
export const getStudentSubmissionFiles = async (req, res) => {
  const { teacherId, courseOfferingId, studentId } = req.params;
  try {
    const ownerCheck = await pool.query(
      `SELECT teacher_id FROM course_offering WHERE course_offering_id = $1`,
      [courseOfferingId]
    );
    if (ownerCheck.rows.length === 0 || String(ownerCheck.rows[0].teacher_id) !== String(teacherId)) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this submission.' });
    }

    const subRes = await pool.query(
      `SELECT ss.submission_id, ss.submitted_at, ss.submission_manifest
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       WHERE e.course_offering_id = $1 AND ss.student_id = $2
       ORDER BY ss.submitted_at DESC LIMIT 1`,
      [courseOfferingId, studentId]
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No submission found for this student.' });
    }
    const submission = subRes.rows[0];
    const manifest = requireManifest(submission);
    const hasReport = Boolean(manifest.report);
    const files = listManifestFiles(manifest);

    res.status(200).json({
      status: 'success',
      submission: {
        submission_id: submission.submission_id,
        submitted_at: submission.submitted_at,
        has_report: hasReport
      },
      files
    });
  } catch (error) {
    console.error('Error fetching student submission files:', error);
    sendError(res, error, 'Failed to fetch submission files.');
  }
};

/* ===========================================================
   5. STUDENT — their own "Submitted Work": labs they've
      submitted to (no security log info exposed here).
=========================================================== */
export const getStudentOwnLabs = async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT co.course_offering_id, c.course_code, c.course_title, s.section_name,
              MAX(ss.submitted_at) AS submitted_at
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       JOIN course_offering co ON e.course_offering_id = co.course_offering_id
       JOIN course c ON co.course_id = c.course_id
       JOIN section s ON co.section_id = s.section_id
       WHERE ss.student_id = $1
       GROUP BY co.course_offering_id, c.course_code, c.course_title, s.section_name
       ORDER BY MAX(ss.submitted_at) DESC`,
      [studentId]
    );
    res.status(200).json({
      status: 'success',
      labs: result.rows.map(r => ({
        course_offering_id: r.course_offering_id,
        label: `${r.course_code} — ${r.course_title} (${r.section_name})`,
        submitted_at: r.submitted_at
      }))
    });
  } catch (error) {
    console.error('Error fetching student\'s own labs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch submitted work.' });
  }
};

/* ===========================================================
   6. STUDENT — files inside one of their own submitted labs
      (ownership verified; no security report included)
=========================================================== */
export const getStudentOwnFiles = async (req, res) => {
  const { studentId, courseOfferingId } = req.params;
  try {
    const subRes = await pool.query(
      `SELECT ss.submission_id, ss.submitted_at, ss.submission_manifest
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       WHERE e.course_offering_id = $1 AND ss.student_id = $2
       ORDER BY ss.submitted_at DESC LIMIT 1`,
      [courseOfferingId, studentId]
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No submission found.' });
    }
    const submission = subRes.rows[0];
    const files = listManifestFiles(requireManifest(submission))
      .map(f => ({ ...f, submission_id: submission.submission_id }));

    res.status(200).json({
      status: 'success',
      submitted_at: submission.submitted_at,
      files
    });
  } catch (error) {
    console.error('Error fetching student\'s own files:', error);
    sendError(res, error, 'Failed to fetch submitted files.');
  }
};

/* ===========================================================
   7. DOWNLOAD a single submitted file (path-based — there is no
      per-file table in the real schema, so ownership is checked
      against the submission row every time).
=========================================================== */
export const downloadFile = async (req, res) => {
  const { submissionId } = req.params;
  const { relativePath, teacherId, studentId, download } = req.query;
  const shouldDownload = String(download || '').toLowerCase() === 'true';

  try {
    const subRes = await pool.query(
      `SELECT ss.submission_manifest, ss.student_id, e.course_offering_id, co.teacher_id
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       JOIN course_offering co ON e.course_offering_id = co.course_offering_id
       WHERE ss.submission_id = $1`,
      [submissionId]
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Submission not found.' });
    }
    const row = subRes.rows[0];

    // Ownership: either the owning student, or the owning teacher — nobody else.
    const isOwningStudent = studentId && String(row.student_id) === String(studentId);
    const isOwningTeacher = teacherId && String(row.teacher_id) === String(teacherId);
    if (!isOwningStudent && !isOwningTeacher) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this file.' });
    }

    const manifest = requireManifest(row);
    const normalizedPath = normalizeSubmissionPath(relativePath);
    // Only submitted work is downloadable here; reports use the teacher route.
    const asset = manifest.files.find(file => file.relative_path === normalizedPath);
    if (!asset) {
      return res.status(404).json({ status: 'error', message: 'File not found.' });
    }

    return await sendAsset(res, asset, path.posix.basename(asset.relative_path), shouldDownload);
  } catch (error) {
    console.error('Error downloading file:', error);
    sendError(res, error, 'Failed to download file.');
  }
};

/* ===========================================================
   8. OPEN or DOWNLOAD the security log report (teacher only)
=========================================================== */
export const downloadReport = async (req, res) => {
  const { teacherId, submissionId } = req.params;
  const { download } = req.query;
  const shouldDownload = String(download || '').toLowerCase() === 'true';

  try {
    const result = await pool.query(
      `SELECT ss.submission_manifest, co.teacher_id, s.registration_no
       FROM student_submission ss
       JOIN exam e ON ss.exam_id = e.exam_id
       JOIN course_offering co ON e.course_offering_id = co.course_offering_id
       JOIN student s ON ss.student_id = s.student_id
       WHERE ss.submission_id = $1`,
      [submissionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Submission not found.' });
    }
    if (String(result.rows[0].teacher_id) !== String(teacherId)) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this report.' });
    }
    const report = requireManifest(result.rows[0]).report;
    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Report file not found.' });
    }
    const fileName = `security_log_${result.rows[0].registration_no}.html`;
    return await sendAsset(res, report, fileName, shouldDownload);
  } catch (error) {
    console.error('Error downloading report:', error);
    sendError(res, error, 'Failed to download report.');
  }
};
