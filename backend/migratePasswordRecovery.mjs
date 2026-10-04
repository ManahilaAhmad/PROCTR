import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from './db.js';

const currentFile = fileURLToPath(import.meta.url);
const migrationPath = path.join(path.dirname(currentFile), '..', 'Database', 'migrations', '002_password_recovery.sql');

try {
  const sql = await readFile(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Password recovery migration applied successfully.');
} catch (error) {
  console.error('Password recovery migration failed:');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
