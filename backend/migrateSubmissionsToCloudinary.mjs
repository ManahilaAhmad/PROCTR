import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db.js';
import { ensureSubmissionSchema } from './service/submissionSchema.js';
import {
  prepareSubmissionFiles, uploadSubmissionAssets, deleteSubmissionAssets, readSubmissionAsset, REPORT_FILENAME
} from './service/submissionStorage.js';

const BACKEND_DIR = fileURLToPath(new URL('.', import.meta.url));
const LEGACY_ROOT = path.join(BACKEND_DIR, 'uploads', 'submissions');
const MAX_FILES = 500;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

function migrationError(code) {
  const error = new Error(code);
  error.migrationCode = code;
  return error;
}

function isWithin(root, target, allowRoot = false) {
  const relative = path.relative(root, target);
  return (allowRoot || relative !== '') && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveLegacySource(recordedPath) {
  if (typeof recordedPath !== 'string' || !recordedPath || recordedPath.includes('\0')) {
    throw migrationError('UNSAFE_LEGACY_PATH');
  }
  const normalized = recordedPath.replace(/\\/g, '/');
  const marker = '/uploads/submissions/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) throw migrationError('UNSAFE_LEGACY_PATH');
  const suffix = normalized.slice(markerIndex + marker.length);
  const segments = suffix.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes(':'))) {
    throw migrationError('UNSAFE_LEGACY_PATH');
  }

  // Old databases can retain the absolute path from before the project moved.
  // Recover only its relative submission folder; never open the old location.
  const currentPath = path.isAbsolute(recordedPath) ? path.resolve(recordedPath) : null;
  if (currentPath && isWithin(LEGACY_ROOT, currentPath)) {
    return { sourcePath: currentPath, relocated: false };
  }
  const sourcePath = path.resolve(LEGACY_ROOT, ...segments);
  if (!isWithin(LEGACY_ROOT, sourcePath)) throw migrationError('UNSAFE_LEGACY_PATH');
  return { sourcePath, relocated: true };
}

// Both lexical paths and real paths must remain in the original submissions
// directory. Reject links at every level, including Windows junctions.
async function checkedEntry(target, realRoot) {
  const absolute = path.resolve(target);
  if (!isWithin(LEGACY_ROOT, absolute)) throw migrationError('UNSAFE_LEGACY_PATH');
  let current = LEGACY_ROOT;
  let stat;
  const segments = path.relative(LEGACY_ROOT, absolute).split(path.sep);
  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i]);
    stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw migrationError('SYMLINK_REJECTED');
    if (i < segments.length - 1 && !stat.isDirectory()) throw migrationError('INVALID_LEGACY_PATH');
  }
  const realPath = await fs.realpath(absolute);
  if (!isWithin(realRoot, realPath)) throw migrationError('UNSAFE_LEGACY_PATH');
  return { realPath, stat };
}

async function readCheckedFile(target, realRoot) {
  const { realPath, stat } = await checkedEntry(target, realRoot);
  if (!stat.isFile()) throw migrationError('NON_REGULAR_FILE');
  if (stat.size > MAX_FILE_BYTES) throw migrationError('FILE_EXCEEDS_10_MB');
  const handle = await fs.open(realPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) {
      throw migrationError('LEGACY_FILE_CHANGED');
    }
    // Re-check ancestors after opening so a swapped directory cannot escape.
    await checkedEntry(target, realRoot);
    const content = await handle.readFile();
    if (content.length !== stat.size) throw migrationError('LEGACY_FILE_CHANGED');
    return content;
  } finally {
    await handle.close();
  }
}

export async function readLegacySubmission(recordedPath) {
  const { sourcePath: submissionPath, relocated } = resolveLegacySource(recordedPath);
  const backendReal = await fs.realpath(BACKEND_DIR);
  for (const directory of [path.join(BACKEND_DIR, 'uploads'), LEGACY_ROOT]) {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink()) throw migrationError('SYMLINK_REJECTED');
    if (!stat.isDirectory()) throw migrationError('INVALID_LEGACY_ROOT');
  }
  const realRoot = await fs.realpath(LEGACY_ROOT);
  if (!isWithin(backendReal, realRoot)) throw migrationError('UNSAFE_LEGACY_PATH');
  const submission = await checkedEntry(submissionPath, realRoot);
  if (!submission.stat.isDirectory()) throw migrationError('INVALID_LEGACY_PATH');

  let report;
  try {
    report = await readCheckedFile(path.join(submissionPath, REPORT_FILENAME), realRoot);
  } catch (error) {
    if (error.code === 'ENOENT') throw migrationError('MISSING_SECURITY_REPORT');
    throw error;
  }

  const files = [];
  let totalBytes = 0;
  async function collect(directory) {
    const names = (await fs.readdir(directory)).sort();
    for (const name of names) {
      if (directory === submissionPath && name === REPORT_FILENAME) continue;
      const filePath = path.join(directory, name);
      const entry = await checkedEntry(filePath, realRoot);
      if (entry.stat.isDirectory()) {
        await collect(filePath);
      } else {
        if (files.length >= MAX_FILES) throw migrationError('TOO_MANY_FILES');
        if (totalBytes + entry.stat.size > MAX_TOTAL_BYTES) throw migrationError('SUBMISSION_EXCEEDS_40_MB');
        const buffer = await readCheckedFile(filePath, realRoot);
        totalBytes += buffer.length;
        files.push({
          relativePath: path.relative(submissionPath, filePath).split(path.sep).join('/'),
          contentBase64: buffer.toString('base64')
        });
      }
    }
  }
  await collect(submissionPath);
  return { files: prepareSubmissionFiles(files), reportHtml: report.toString('utf8'), reportBuffer: report, relocated };
}

export async function migrateSubmissions() {
  await ensureSubmissionSchema();
  const result = await pool.query(`
    SELECT ss.submission_id, ss.student_id, ss.exam_id, ss.submission_path, co.teacher_id
    FROM student_submission ss
    JOIN exam e ON e.exam_id = ss.exam_id
    JOIN course_offering co ON co.course_offering_id = e.course_offering_id
    WHERE ss.submission_manifest IS NULL
    ORDER BY ss.submission_id
  `);
  const counts = { migrated: 0, skipped: 0, failed: 0 };
  for (const row of result.rows) {
    let pendingManifest;
    let updateAttempted = false;
    try {
      const { files, reportHtml, reportBuffer, relocated } = await readLegacySubmission(row.submission_path);
      if (relocated) console.log(`Submission ${row.submission_id}: using relocated local submission folder.`);
      pendingManifest = await uploadSubmissionAssets({
        examId: row.exam_id, studentId: row.student_id, teacherId: row.teacher_id,
        files, reportHtml
      });
      // Verify actual delivery before changing the only database pointer.
      // This catches account delivery restrictions as well as corrupt uploads.
      for (const original of files) {
        const asset = pendingManifest.files.find(file => file.relative_path === original.relative_path);
        if (!asset || !(await readSubmissionAsset(asset)).equals(original.buffer)) {
          throw migrationError('CLOUD_FILE_VERIFICATION_FAILED');
        }
      }
      if (!(await readSubmissionAsset(pendingManifest.report)).equals(reportBuffer)) {
        throw migrationError('CLOUD_REPORT_VERIFICATION_FAILED');
      }
      // A concurrent migration or fresh student upload wins without being
      // overwritten. The old timestamp and all original files stay intact.
      updateAttempted = true;
      const updated = await pool.query(
        `UPDATE student_submission
         SET submission_manifest = $1::jsonb, submission_path = $2
         WHERE submission_id = $3 AND submission_manifest IS NULL AND submission_path = $4
         RETURNING submission_id`,
        [JSON.stringify(pendingManifest), `cloudinary://${pendingManifest.folder}`, row.submission_id, row.submission_path]
      );
      if (!updated.rows.length) {
        updateAttempted = false;
        await deleteSubmissionAssets(pendingManifest);
        pendingManifest = undefined;
        counts.skipped++;
        console.log(`Submission ${row.submission_id}: skipped because it changed during migration.`);
        continue;
      }
      pendingManifest = undefined;
      counts.migrated++;
      console.log(`Submission ${row.submission_id}: migrated ${files.length} files.`);
    } catch (error) {
      if (pendingManifest && !updateAttempted) {
        await deleteSubmissionAssets(pendingManifest).catch(() => {
          console.error(`Submission ${row.submission_id}: cloud cleanup failed.`);
        });
      }
      counts.failed++;
      // Do not print filesystem paths, account details, or provider responses.
      const code = updateAttempted ? 'UPDATE_OUTCOME_UNKNOWN_ASSETS_RETAINED' : error.migrationCode || 'MIGRATION_FAILED';
      console.error(`Submission ${row.submission_id}: failed (${code}).`);
    }
  }
  console.log(`Migration complete: ${counts.migrated} migrated, ${counts.skipped} skipped, ${counts.failed} failed.`);
  return counts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const counts = await migrateSubmissions();
    if (counts.failed) process.exitCode = 1;
  } catch {
    console.error('Migration could not start. Check database access and the backend environment.');
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => { process.exitCode = 1; });
  }
}
